import { create } from 'zustand'
import type { ProviderType } from '@/hooks/useSpeechProvider'
import { persist } from 'zustand/middleware'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Mode = 'speed' | 'clarity'
export type TestState = 'idle' | 'running' | 'ended'
export type Duration = 15 | 30 | 60 | 120
export type PromptType = 'sentences' | 'numbers' | 'custom' | 'technical' | 'tongue-twisters'
export type FontChoice = 'jetbrains' | 'fira' | 'inconsolata'
export type FontSize = 'small' | 'medium' | 'large'
export type { ThemeName } from '@/lib/themes'

export interface DiffWord {
  word: string
  tag: 'correct' | 'substituted' | 'missed' | 'added'
  expected?: string
}

export interface PersonalBestEntry {
  wpm: number
  date: string
}

export interface Settings {
  theme: import('@/lib/themes').ThemeName
  accentHex: string
  accentName: string
  font: FontChoice
  fontSize: FontSize
  fillerFlash: boolean
  showLiveTranscript: boolean
  smoothCaret: boolean
  blindMode: boolean
  language: 'en-US' | 'en-GB' | 'en-AU'
  sttProvider: ProviderType
  skipVad: boolean
  personalBests: Record<string, PersonalBestEntry>
  /** netWpm of the most recent speed run, used to show a delta on the results screen. */
  lastSpeedWpm?: number
}

export interface SpeedResults {
  netWpm: number
  rawWpm: number
  fillerCount: number
  /** Percentage: correct prompt words / prompt.length * 100 */
  accuracy: number
  diff: DiffWord[]
  elapsedSec: number
  /** Raw spoken transcript (fillers stripped), shown in the detailed breakdown. */
  transcript: string
  /** netWpm delta vs the previous speed run (null when there is no prior run). */
  deltaWpm: number | null
  /** Highest speaking momentum reached during the session (0–100). */
  peakMomentum: number
  /** Speaking pace consistency score 0–100. */
  consistency: number
}

interface TestStore {
  // ── Core state
  mode: Mode
  testState: TestState
  duration: Duration
  promptType: PromptType
  customPromptText: string

  // ── Prompt
  prompt: string[]

  // ── Speed results (populated only when testState === 'ended')
  results: SpeedResults | null

  // ── Clarity mode
  clarityTranscript: string
  diffResult: DiffWord[]
  clarityScore: number
  clarityGrade: 'S' | 'A' | 'B' | 'C' | 'needs work'

  // ── Settings (persisted)
  settings: Settings

  // ── Mic state
  micState: 'idle' | 'requesting' | 'active' | 'denied' | 'error'

  // ── Actions
  setMode: (mode: Mode) => void
  setTestState: (state: TestState) => void
  setDuration: (d: Duration) => void
  setPromptType: (t: PromptType) => void
  setCustomPromptText: (text: string) => void
  setPrompt: (words: string[]) => void
  setResults: (r: SpeedResults | null) => void
  setClarityTranscript: (t: string) => void
  setDiffResult: (result: DiffWord[], score: number, grade: TestStore['clarityGrade']) => void
  updateSettings: (patch: Partial<Settings>) => void
  setMicState: (s: TestStore['micState']) => void
  setSttProvider: (p: ProviderType) => void
  /** Returns true if this was a new personal best. */
  checkAndUpdatePersonalBest: (key: string, wpm: number) => boolean
  resetTest: () => void
  startTest: () => void
}

// ─── Default settings ─────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Settings = {
  theme: 'latte',
  accentHex: '#3b82f6',
  accentName: 'blue',
  font: 'jetbrains',
  fontSize: 'medium',
  fillerFlash: true,
  showLiveTranscript: true,
  smoothCaret: true,
  blindMode: false,
  language: 'en-US',
  sttProvider: 'webspeech',
  skipVad: false,
  personalBests: {},
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTestStore = create<TestStore>()(
  persist(
    (set, get) => ({
      mode: 'speed',
      testState: 'idle',
      duration: 30,
      promptType: 'sentences',
      customPromptText: '',
      prompt: [],
      results: null,
      clarityTranscript: '',
      diffResult: [],
      clarityScore: 0,
      clarityGrade: 'needs work',
      settings: DEFAULT_SETTINGS,
      micState: 'idle',

      setMode: (mode) => set({ mode }),
      setTestState: (testState) => set({ testState }),
      setDuration: (duration) => set({ duration }),
      setPromptType: (promptType) => set({ promptType }),
      setCustomPromptText: (customPromptText) => set({ customPromptText }),
      setPrompt: (prompt) => set({ prompt }),
      setResults: (results) => set({ results }),

      setClarityTranscript: (clarityTranscript) => set({ clarityTranscript }),

      setDiffResult: (diffResult, clarityScore, clarityGrade) =>
        set({ diffResult, clarityScore, clarityGrade }),

      updateSettings: (patch) => {
        const newSettings = { ...get().settings, ...patch }
        set({ settings: newSettings })
        if (typeof document !== 'undefined') {
          import('@/lib/themes').then(({ applyTheme, THEMES }) => {
            const theme = THEMES[newSettings.theme] ?? THEMES.latte
            applyTheme(theme, newSettings.accentHex)
          })
          const html = document.documentElement
          if (patch.font)     html.dataset.font      = newSettings.font
          if (patch.fontSize) html.dataset.fontsize  = newSettings.fontSize
        }
      },

      setMicState: (micState) => set({ micState }),

      setSttProvider: (p) => set((s) => ({ settings: { ...s.settings, sttProvider: p } })),

      checkAndUpdatePersonalBest: (key, wpm) => {
        const bests = get().settings.personalBests ?? {}
        const current = bests[key]
        if (!current || wpm > current.wpm) {
          set((s) => ({
            settings: {
              ...s.settings,
              personalBests: {
                ...(s.settings.personalBests ?? {}),
                [key]: { wpm, date: new Date().toISOString() },
              },
            },
          }))
          return true
        }
        return false
      },

      startTest: () => {
        set({
          testState: 'running',
          results: null,
          clarityTranscript: '',
          diffResult: [],
          clarityScore: 0,
          clarityGrade: 'needs work',
        })
      },

      resetTest: () => {
        set({
          testState: 'idle',
          results: null,
          clarityTranscript: '',
          diffResult: [],
          clarityScore: 0,
          clarityGrade: 'needs work',
          micState: 'idle',
        })
      },
    }),
    {
      name: 'monkeyspeak-settings',
      partialize: (state) => ({ settings: state.settings }),
      merge: (persisted, current) => {
        const p = persisted as { settings?: Partial<Settings> }
        return {
          ...current,
          settings: {
            ...DEFAULT_SETTINGS,
            ...(p?.settings ?? {}),
            personalBests: {
              ...DEFAULT_SETTINGS.personalBests,
              ...(p?.settings?.personalBests ?? {}),
            },
          },
        }
      },
    }
  )
)
