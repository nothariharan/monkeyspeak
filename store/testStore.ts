import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Mode = 'speed' | 'clarity'
export type TestState = 'idle' | 'running' | 'ended'
export type Duration = 15 | 30 | 60 | 120
export type PromptType = 'sentences' | 'numbers' | 'custom' | 'technical' | 'tongue-twisters'
export type AccentColour = 'yellow' | 'coral' | 'blue' | 'green'
export type FontChoice = 'jetbrains' | 'fira' | 'inconsolata'
export type FontSize = 'small' | 'medium' | 'large'
export type { ThemeName } from '@/lib/themes'

export interface WordResult {
  word: string
  isCorrect: boolean
  isFiller: boolean
  timestamp: number
}

export interface DiffWord {
  word: string
  tag: 'correct' | 'substituted' | 'missed' | 'added'
  expected?: string
}

export interface Settings {
  theme: import('@/lib/themes').ThemeName
  accentHex: string          // raw hex from the theme's accent swatch
  accentName: string         // swatch name for persistence
  font: FontChoice
  fontSize: FontSize
  fillerFlash: boolean
  showLiveTranscript: boolean
  smoothCaret: boolean
  language: 'en-US' | 'en-GB' | 'en-AU'
}

interface WpmSnapshot {
  wpm: number
  timestamp: number
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
  currentWordIndex: number

  // ── Speed mode metrics
  confirmedWords: WordResult[]
  fillerCount: number
  wpm: number
  peakWpm: number
  consistency: number
  wpmSnapshots: WpmSnapshot[]

  // ── Clarity mode
  clarityTranscript: string
  diffResult: DiffWord[]
  clarityScore: number
  clarityGrade: 'S' | 'A' | 'B' | 'C' | 'needs work'

  // ── Settings (persisted)
  settings: Settings

  // ── Filler flash state
  fillerFlashTrigger: number   // incremented each time a filler is detected
  recentFillerCount: number    // fillers in last 10-second window
  fillerWarning: boolean       // true if 3+ fillers in 10s

  // ── Mic state
  micState: 'idle' | 'requesting' | 'active' | 'denied' | 'error'

  // ── Actions
  setMode: (mode: Mode) => void
  setTestState: (state: TestState) => void
  setDuration: (d: Duration) => void
  setPromptType: (t: PromptType) => void
  setCustomPromptText: (text: string) => void
  setPrompt: (words: string[]) => void
  addWord: (result: WordResult) => void
  detectFiller: () => void
  advanceWord: () => void
  setWpm: (wpm: number) => void
  setPeakWpm: (wpm: number) => void
  addWpmSnapshot: (snapshot: WpmSnapshot) => void
  finaliseConsistency: () => void
  setClarityTranscript: (t: string) => void
  setDiffResult: (result: DiffWord[], score: number, grade: TestStore['clarityGrade']) => void
  updateSettings: (patch: Partial<Settings>) => void
  setMicState: (s: TestStore['micState']) => void
  resetTest: () => void
  startTest: () => void
}

// ─── Default settings ─────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Settings = {
  theme: 'mocha',
  accentHex: '#cba6f7',   // mocha mauve
  accentName: 'mauve',
  font: 'jetbrains',
  fontSize: 'medium',
  fillerFlash: true,
  showLiveTranscript: true,
  smoothCaret: true,
  language: 'en-US',
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTestStore = create<TestStore>()(
  persist(
    (set, get) => ({
      // Defaults
      mode: 'speed',
      testState: 'idle',
      duration: 30,
      promptType: 'sentences',
      customPromptText: '',
      prompt: [],
      currentWordIndex: 0,
      confirmedWords: [],
      fillerCount: 0,
      wpm: 0,
      peakWpm: 0,
      consistency: 100,
      wpmSnapshots: [],
      clarityTranscript: '',
      diffResult: [],
      clarityScore: 0,
      clarityGrade: 'needs work',
      settings: DEFAULT_SETTINGS,
      fillerFlashTrigger: 0,
      recentFillerCount: 0,
      fillerWarning: false,
      micState: 'idle',

      // ── Actions ────────────────────────────────────────────────────────────

      setMode: (mode) => set({ mode }),
      setTestState: (testState) => set({ testState }),
      setDuration: (duration) => set({ duration }),
      setPromptType: (promptType) => set({ promptType }),
      setCustomPromptText: (customPromptText) => set({ customPromptText }),
      setPrompt: (prompt) => set({ prompt, currentWordIndex: 0 }),

      addWord: (result) =>
        set((s) => ({
          confirmedWords: [...s.confirmedWords, result],
        })),

      detectFiller: () => {
        const s = get()
        const now = Date.now()
        // Count fillers detected in last 10 seconds
        const recentWindow = 10_000
        // We'll track recentFillerCount separately and set fillerWarning
        const newCount = s.recentFillerCount + 1
        const isWarning = newCount >= 3
        set({
          fillerCount: s.fillerCount + 1,
          fillerFlashTrigger: s.fillerFlashTrigger + 1,
          recentFillerCount: newCount,
          fillerWarning: isWarning,
        })
        // Reset recent count after 10s
        setTimeout(() => {
          set((cur) => ({
            recentFillerCount: Math.max(0, cur.recentFillerCount - 1),
            fillerWarning: cur.recentFillerCount - 1 >= 3,
          }))
        }, recentWindow)
      },

      advanceWord: () =>
        set((s) => ({ currentWordIndex: s.currentWordIndex + 1 })),

      setWpm: (wpm) => set({ wpm }),
      setPeakWpm: (peakWpm) => set({ peakWpm }),
      addWpmSnapshot: (snapshot) =>
        set((s) => ({ wpmSnapshots: [...s.wpmSnapshots, snapshot] })),

      finaliseConsistency: () => {
        const { wpmSnapshots } = get()
        if (wpmSnapshots.length < 2) {
          set({ consistency: 100 })
          return
        }
        const values = wpmSnapshots.map((s) => s.wpm)
        const mean = values.reduce((a, b) => a + b, 0) / values.length
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
        const stdDev = Math.sqrt(variance)
        const consistency = Math.max(0, Math.min(100, Math.round(100 - (stdDev / mean) * 100)))
        set({ consistency })
      },

      setClarityTranscript: (clarityTranscript) => set({ clarityTranscript }),

      setDiffResult: (diffResult, clarityScore, clarityGrade) =>
        set({ diffResult, clarityScore, clarityGrade }),

      updateSettings: (patch) => {
        const newSettings = { ...get().settings, ...patch }
        set({ settings: newSettings })
        // Apply to DOM
        if (typeof document !== 'undefined') {
          const { applyTheme, THEMES } = require('@/lib/themes')
          const theme = THEMES[newSettings.theme]
          applyTheme(theme, newSettings.accentHex)
          const html = document.documentElement
          if (patch.font)     html.dataset.font      = newSettings.font
          if (patch.fontSize) html.dataset.fontsize  = newSettings.fontSize
        }
      },

      setMicState: (micState) => set({ micState }),

      startTest: () =>
        set({
          testState: 'running',
          confirmedWords: [],
          fillerCount: 0,
          wpm: 0,
          peakWpm: 0,
          consistency: 100,
          wpmSnapshots: [],
          currentWordIndex: 0,
          fillerFlashTrigger: 0,
          recentFillerCount: 0,
          fillerWarning: false,
          clarityTranscript: '',
          diffResult: [],
          clarityScore: 0,
        }),

      resetTest: () =>
        set({
          testState: 'idle',
          confirmedWords: [],
          fillerCount: 0,
          wpm: 0,
          peakWpm: 0,
          consistency: 100,
          wpmSnapshots: [],
          currentWordIndex: 0,
          fillerFlashTrigger: 0,
          recentFillerCount: 0,
          fillerWarning: false,
          clarityTranscript: '',
          diffResult: [],
          clarityScore: 0,
          micState: 'idle',
        }),
    }),
    {
      name: 'monkeyspeak-settings',
      // Only persist settings, not transient test state
      partialize: (state) => ({ settings: state.settings }),
    }
  )
)
