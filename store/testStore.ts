import { create } from 'zustand'
import type { ProviderType } from '@/hooks/useSpeechProvider'
import { persist } from 'zustand/middleware'
import { evaluateAchievements } from '@/lib/achievements'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Mode = 'speed' | 'clarity' | 'ghost'
export type TestState = 'idle' | 'running' | 'ended'
export type Duration = 15 | 30 | 60 | 120
export type PromptType = 'sentences' | 'numbers' | 'custom' | 'technical' | 'tongue-twisters' | 'daily' | `daily-${string}`
export type FontChoice = 'jetbrains' | 'fira' | 'inconsolata'
export type FontSize = 'small' | 'medium' | 'large'
export type EndCondition = 'timer' | 'passage'
export type PromptDifficulty = 'easy' | 'normal' | 'hard'
export type { ThemeName } from '@/lib/themes'

export interface DiffWord {
  word: string
  tag: 'correct' | 'substituted' | 'missed' | 'added'
  expected?: string
}

export interface PersonalBestEntry {
  wpm: number
  date: string
  /** Per-second progress of the performance, used by Ghost Race replays. */
  timeline?: SessionTimeline
}

export interface LeaderboardEntry {
  id: string
  name: string
  wpm: number
  accuracy: number
  duration: Duration
  promptType: PromptType
  date: string
  emoji?: string
}

export interface Settings {
  theme: import('@/lib/themes').ThemeName
  accentHex: string
  accentName: string
  font: FontChoice
  fontSize: FontSize
  fillerFlash: boolean
  smoothCaret: boolean
  blindMode: boolean
  language: 'en-US' | 'en-GB' | 'en-AU'
  sttProvider: ProviderType
  skipVad: boolean
  personalBests: Record<string, PersonalBestEntry>
  leaderboardName?: string
  leaderboardEmoji?: string
  /** netWpm of the most recent speed run, used to show a delta on the results screen. */
  lastSpeedWpm?: number
  /** Last 20 completed test runs, newest first. */
  sessionHistory: SessionHistoryEntry[]
  /** Whether the test ends on timer expiry or when all prompt words are spoken. */
  endCondition: EndCondition
  /** Difficulty for sentences mode: easy = simple short words, normal = common, hard = complex. */
  promptDifficulty: PromptDifficulty
  /** Speaking frequency per calendar day: "YYYY-MM-DD" -> count */
  speakingActivity: Record<string, number>
  /** IDs of achievements unlocked by the user */
  unlockedAchievements: string[]
  /** Aggregated speaker statistics */
  lifetimeStats: {
    totalRuns: number
    totalSeconds: number
    totalWords: number
    totalFillers: number
    avgAccuracy: number
    /** Running sum of every run's accuracy. avgAccuracy is derived from this to avoid rounding drift. */
    accuracySum: number
  }
  /** Date of the most recently started daily challenge: "YYYY-MM-DD" */
  lastStartedDailyChallengeDate?: string
}

export interface SessionTimeline {
  raw: { second: number; wpm: number }[]
  wpm: { second: number; wpm: number }[]
  momentum: { second: number; value: number }[]
  errors: { second: number; wpm: number }[]
  progress?: { second: number; words: number }[]
  wordWindows?: { startSecond: number; endSecond: number; label: string }[]
}

export interface SessionHistoryEntry {
  date: string
  mode: 'speed' | 'clarity'
  duration: number
  promptType: string
  netWpm: number
  accuracy: number
  fillerCount: number
  missedWords?: string[]
  consistency?: number
  /** Actual number of words spoken this run. When absent, lifetime stats fall back to a WPM estimate. */
  wordsSpoken?: number
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
  /** Speaking pace consistency score 0–100. */
  consistency: number
  /** Per-second WPM + momentum series for the post-session graph. */
  timeline?: SessionTimeline
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
  clarityToolId: string
  clarityToolName: string

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
  setClarityTool: (id: string, name: string) => void
  updateSettings: (patch: Partial<Settings>) => void
  setMicState: (s: TestStore['micState']) => void
  setSttProvider: (p: ProviderType) => void
  setLeaderboardName: (name: string) => void
  setLeaderboardEmoji: (emoji: string) => void
  /** Returns true if this was a new personal best. */
  checkAndUpdatePersonalBest: (key: string, wpm: number, timeline?: SessionTimeline) => boolean
  pushSessionHistory: (entry: SessionHistoryEntry) => void
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
  smoothCaret: true,
  blindMode: false,
  language: 'en-US',
  sttProvider: 'webspeech',
  skipVad: true,
  personalBests: {},
  sessionHistory: [],
  endCondition: 'timer',
  promptDifficulty: 'normal',
  speakingActivity: {},
  unlockedAchievements: [],
  lifetimeStats: {
    totalRuns: 0,
    totalSeconds: 0,
    totalWords: 0,
    totalFillers: 0,
    avgAccuracy: 0,
    accuracySum: 0,
  },
  lastStartedDailyChallengeDate: undefined,
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
      clarityToolId: 'wispr',
      clarityToolName: 'Wispr Flow',
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
      setClarityTool: (clarityToolId, clarityToolName) => set({ clarityToolId, clarityToolName }),

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

      setLeaderboardName: (name) =>
        set((s) => ({
          settings: {
            ...s.settings,
            leaderboardName: name.trim(),
          },
        })),

      setLeaderboardEmoji: (emoji) =>
        set((s) => ({
          settings: {
            ...s.settings,
            leaderboardEmoji: emoji,
          },
        })),

      pushSessionHistory: (entry) =>
        set((s) => {
          const dateStr = new Date(entry.date).toISOString().split('T')[0] ?? new Date().toISOString().split('T')[0]
          
          // 1. Update activity heatmap
          const activity = { ...s.settings.speakingActivity }
          activity[dateStr] = (activity[dateStr] ?? 0) + 1

          // 2. Words spoken this session — prefer the real count, fall back to a WPM estimate for legacy entries
          const wordsSpoken = entry.wordsSpoken ?? Math.round(entry.netWpm * (entry.duration / 60))

          // 3. Update lifetime stats
          const currentStats = s.settings.lifetimeStats ?? {
            totalRuns: 0,
            totalSeconds: 0,
            totalWords: 0,
            totalFillers: 0,
            avgAccuracy: 0,
            accuracySum: 0,
          }
          const nextRuns = currentStats.totalRuns + 1
          // Accumulate a raw accuracy sum and derive the average from it, so repeated
          // rounding of the running average can't drift over many sessions.
          const nextAccuracySum = (currentStats.accuracySum ?? currentStats.avgAccuracy * currentStats.totalRuns) + entry.accuracy
          const nextStats = {
            totalRuns: nextRuns,
            totalSeconds: currentStats.totalSeconds + entry.duration,
            totalWords: currentStats.totalWords + wordsSpoken,
            totalFillers: currentStats.totalFillers + entry.fillerCount,
            avgAccuracy: Math.round(nextAccuracySum / nextRuns),
            accuracySum: nextAccuracySum,
          }

          // 4. Evaluate newly unlocked achievements
          const currentUnlocked = s.settings.unlockedAchievements ?? []
          const nextUnlocked = evaluateAchievements(currentUnlocked, nextStats, entry)

          // 5. Fire global custom event if a new badge unlocks (to show overlay / notification)
          if (nextUnlocked.length > currentUnlocked.length && typeof window !== 'undefined') {
            const newlyUnlockedBadgeIds = nextUnlocked.filter(id => !currentUnlocked.includes(id))
            window.dispatchEvent(new CustomEvent('monkeyspeak:badge-unlocked', { detail: newlyUnlockedBadgeIds }))
          }

          return {
            settings: {
              ...s.settings,
              sessionHistory: [entry, ...(s.settings.sessionHistory ?? [])].slice(0, 100),
              speakingActivity: activity,
              lifetimeStats: nextStats,
              unlockedAchievements: nextUnlocked,
            },
          }
        }),

      checkAndUpdatePersonalBest: (key, wpm, timeline) => {
        const bests = get().settings.personalBests ?? {}
        const current = bests[key]
        if (!current || wpm > current.wpm) {
          set((s) => ({
            settings: {
              ...s.settings,
              personalBests: {
                ...(s.settings.personalBests ?? {}),
                [key]: { wpm, date: new Date().toISOString(), timeline },
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
            sessionHistory: p?.settings?.sessionHistory ?? [],
            endCondition: p?.settings?.endCondition ?? 'timer',
            promptDifficulty: p?.settings?.promptDifficulty ?? 'normal',
            speakingActivity: p?.settings?.speakingActivity ?? {},
            unlockedAchievements: p?.settings?.unlockedAchievements ?? [],
            lifetimeStats: (() => {
              const persistedStats = { ...DEFAULT_SETTINGS.lifetimeStats, ...(p?.settings?.lifetimeStats ?? {}) }
              // Seed accuracySum for pre-existing users who never had the field.
              if (p?.settings?.lifetimeStats && p.settings.lifetimeStats.accuracySum === undefined) {
                persistedStats.accuracySum = persistedStats.avgAccuracy * persistedStats.totalRuns
              }
              return persistedStats
            })(),
            lastStartedDailyChallengeDate: p?.settings?.lastStartedDailyChallengeDate,
          },
        }
      },
    }
  )
)
