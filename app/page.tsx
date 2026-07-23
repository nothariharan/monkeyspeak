'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { gsap } from 'gsap'

import Link from 'next/link'
import { useTestStore } from '@/store/testStore'
import { useTimer } from '@/hooks/useTimer'
import { useActiveSpeechProvider } from '@/hooks/useActiveSpeechProvider'
import { generatePrompt, generateClarityPrompt, regeneratePrompt, generatePracticePrompt, generateDailyPrompt, type PromptMode } from '@/lib/prompts'
import { getLocalDateStr, calculateSpeakingStreak } from '@/lib/stats/streak'
import { diffWords, calcClarityScore, calcPunctuationScore } from '@/lib/diff'
import { submitClarityBenchmark } from '@/lib/clarityLeaderboard/client'
import { alignTranscriptToPrompt, countFillers } from '@/lib/alignTranscriptToPrompt'
import { netWpmFromChars, rawWpmFromChars } from '@/lib/stats/wpm'
import { computeConsistency } from '@/lib/stats/consistency'
import { buildSessionTimeline, type TimelineSample } from '@/lib/stats/timeline'
import { useSpeakingGame } from '@/hooks/useSpeakingGame'

import Header from '@/components/Header'
import ConfigBar from '@/components/ConfigBar'
import StatsBar from '@/components/StatsBar'
import SpeakingGame from '@/components/game/SpeakingGame'
import GhostRace from '@/components/game/GhostRace'
import ClarityInput from '@/components/ClarityInput'
import ResultsPanel from '@/components/ResultsPanel'
import SettingsPanel from '@/components/SettingsPanel'
import ProfileHub from '@/components/ProfileHub'
import HeroLeaderboard from '@/components/decor/HeroLeaderboard'
import HeroMonkey from '@/components/decor/HeroMonkey'
import HeroTopScore from '@/components/decor/HeroTopScore'
import HeroDailyGoal from '@/components/decor/HeroDailyGoal'
import HeroQuickTips from '@/components/decor/HeroQuickTips'
import LeaderboardSavePrompt from '@/components/decor/LeaderboardSavePrompt'
import CapabilityBanner from '@/components/CapabilityBanner'
import Toast from '@/components/Toast'
import type { Duration, PromptType } from '@/store/testStore'

type PendingLeaderboardScore = {
  wpm: number
  accuracy: number
  duration: Duration
  promptType: PromptType
}

function splitPrompt(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

export default function Home() {
  const store = useTestStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [unlockedBadgeNames, setUnlockedBadgeNames] = useState<string[]>([])
  const [isPersonalBest, setIsPersonalBest] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [dissolvedCount, setDissolvedCount] = useState(0)
  const [isEnding, setIsEnding] = useState(false)
  const [micHovered, setMicHovered] = useState(false)
  const [pendingLeaderboardScore, setPendingLeaderboardScore] = useState<PendingLeaderboardScore | null>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const gameMetricsRef = useRef({ rawWpms: [] as number[] })
  const timelineRef = useRef<TimelineSample[]>([])

  const [testStartedAt, setTestStartedAt] = useState<number | null>(null)
  const testStartedAtRef = useRef<number | null>(null)
  const confirmedWordsRef = useRef<string[]>([])
  const interimTextRef = useRef('')

  const sttProvider = store.settings.sttProvider ?? 'webspeech'
  const endCondition = store.settings.endCondition ?? 'timer'
  const {
    interimText,
    previewWords,
    confirmedWords,
    isListening,
    error: sttError,
    micStream,
    audioActive,
    activeSource,
    startSession,
    retryWithDeepgram,
    stopSession,
    reset: resetProvider,
    fallbackMessage,
    clearFallbackMessage,
  } = useActiveSpeechProvider(sttProvider)

  const speechActive =
    Boolean(audioActive) ||
    previewWords.length > 0 ||
    interimText.trim().length > 0 ||
    (isListening && confirmedWords.length > 0)

  const waveActivity = (() => {
    if (audioActive) return 0.9
    if (previewWords.length > 0 || interimText.trim().length > 0) return 0.72
    if (isListening && confirmedWords.length > 0) return 0.55
    if (isListening) return 0.32
    return 0
  })()

  useEffect(() => { confirmedWordsRef.current = confirmedWords }, [confirmedWords])
  useEffect(() => { interimTextRef.current = interimText }, [interimText])

  const isSpeedRunning = store.testState === 'running' && store.mode !== 'clarity'

  const speakingGame = useSpeakingGame({
    prompt: store.prompt,
    confirmedWords,
    previewWords,
    isActive: isSpeedRunning,
    startedAt: testStartedAt,
  })

  useEffect(() => {
    if (store.testState !== 'running' || store.mode === 'clarity') return
    setDissolvedCount(Math.min(speakingGame.displayIndex, store.prompt.length))
  }, [store.testState, store.mode, store.prompt.length, speakingGame.displayIndex])

  useEffect(() => {
    gameMetricsRef.current.rawWpms = speakingGame.rawWpms
  }, [speakingGame.rawWpms])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onBadge = (e: Event) => {
      const ids = (e as CustomEvent<string[]>).detail
      import('@/lib/achievements').then(({ ACHIEVEMENTS }) => {
        const names = ids.map(id => ACHIEVEMENTS.find(a => a.id === id)?.title ?? id)
        setUnlockedBadgeNames(prev => [...prev, ...names])
      })
    }
    window.addEventListener('monkeyspeak:badge-unlocked', onBadge)
    return () => window.removeEventListener('monkeyspeak:badge-unlocked', onBadge)
  }, [])

  useEffect(() => {
    const applyFromStore = () => {
      const { settings } = useTestStore.getState()
      const html = document.documentElement
      import('@/lib/themes').then(({ THEMES, applyTheme }) => {
        const theme = THEMES[settings.theme] ?? THEMES.latte
        applyTheme(theme, settings.accentHex)
      })
      html.dataset.font = settings.font
      html.dataset.fontsize = settings.fontSize
    }

    applyFromStore()
    // localStorage hydrate can land after first paint. run again when it finishes.
    const unsub = useTestStore.persist.onFinishHydration(applyFromStore)
    return unsub
  }, [])

  const finalizeSpeed = useCallback((elapsedSec: number) => {
    stopSession()

    const s = useTestStore.getState()
    const resultDuration = s.duration
    const resultPromptType = s.promptType
    const fullTranscriptParts = [...confirmedWordsRef.current]
    const interim = interimTextRef.current.trim()
    if (interim) {
      fullTranscriptParts.push(...interim.split(/\s+/).filter(Boolean))
    }
    const fullTranscript = fullTranscriptParts.join(' ')

    const diff = alignTranscriptToPrompt(fullTranscript, s.prompt)
    const fillerCount = countFillers(fullTranscript)

    const correctWords = diff.filter((w) => w.tag === 'correct')
    const correctChars = correctWords.reduce((sum, w) => sum + w.word.length + 1, 0)
    const allSpokenWords = diff.filter((w) => w.tag !== 'missed')
    const allSpokenChars = allSpokenWords.reduce((sum, w) => sum + w.word.length + 1, 0)

    const netWpm = netWpmFromChars(correctChars, elapsedSec)
    const rawWpm = rawWpmFromChars(allSpokenChars, elapsedSec)
    const accuracy = s.prompt.length > 0
      ? Math.round((correctWords.length / s.prompt.length) * 100)
      : 0

    const timeline = buildSessionTimeline(timelineRef.current, diff)
    const pbKey = `speed-${s.duration}s-${s.promptType}`
    const newBest = s.checkAndUpdatePersonalBest(pbKey, netWpm, timeline)
    setIsPersonalBest(newBest)

    const prevWpm = s.settings.lastSpeedWpm
    const deltaWpm = typeof prevWpm === 'number' ? netWpm - prevWpm : null
    s.updateSettings({ lastSpeedWpm: netWpm })

    const metrics = gameMetricsRef.current
    const consistency = computeConsistency(metrics.rawWpms)
    const todayStr = getLocalDateStr()
    const activeDailyKey = resultPromptType === 'daily' ? `daily-${todayStr}` : resultPromptType

    const missedWordsList = diff
      .filter((w) => w.tag === 'missed' || w.tag === 'substituted')
      .map((w) => w.tag === 'substituted' ? (w.expected ?? w.word) : w.word)
      .map(w => w.toLowerCase().replace(/[^a-z0-9']/g, '').trim())
      .filter(Boolean)

    setIsEnding(true)
    window.setTimeout(() => {
      s.setResults({
        netWpm,
        rawWpm,
        fillerCount,
        accuracy,
        diff,
        elapsedSec,
        transcript: fullTranscript,
        deltaWpm,
        consistency,
        timeline,
      })
      s.pushSessionHistory({
        date: new Date().toISOString(),
        mode: 'speed',
        duration: resultDuration,
        promptType: activeDailyKey,
        netWpm,
        accuracy,
        fillerCount,
        missedWords: missedWordsList,
        consistency,
        wordsSpoken: allSpokenWords.length,
      })
      s.setTestState('ended')
      setPendingLeaderboardScore({
        wpm: netWpm,
        accuracy,
        duration: resultDuration,
        promptType: activeDailyKey as PromptType,
      })
      setIsEnding(false)
    }, 1200)
  }, [stopSession])

  const handleTimerEnd = useCallback(() => {
    if (useTestStore.getState().settings.endCondition === 'passage') return
    finalizeSpeed(store.duration)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalizeSpeed, store.duration])

  const { timeRemaining, isWarning, start: startTimer, stop: stopTimer, reset: resetTimer } =
    useTimer(store.duration, handleTimerEnd)

  useEffect(() => {
    if (isListening) store.setMicState('active')
    else if (sttError?.toLowerCase().includes('permission denied')) store.setMicState('denied')
    else if (useTestStore.getState().micState !== 'requesting') store.setMicState('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sttError, isListening])

  // runtime failsafe
  useEffect(() => {
    if (store.testState !== 'running' || store.mode === 'clarity') return
    if (!retryWithDeepgram) return

    const timer = window.setTimeout(() => {
      if (speakingGame.displayIndex > 0 || confirmedWords.length > 0) return
      if (!isListening && waveActivity < 0.25) return
      void retryWithDeepgram().then((result) => {
        if (!result.ok) {
          setStartError(result.error ?? 'Deepgram speech recognition failed. try browser mode or check your connection')
        }
      })
    }, 5000)

    return () => clearTimeout(timer)
  }, [
    store.testState,
    store.mode,
    sttProvider,
    speakingGame.displayIndex,
    confirmedWords.length,
    isListening,
    waveActivity,
    retryWithDeepgram,
  ])

  const loadPrompt = useCallback(() => {
    const s = useTestStore.getState()
    if (s.promptType === 'daily') {
      const today = getLocalDateStr()
      const text = generateDailyPrompt(today)
      s.setPrompt(splitPrompt(text))
    } else {
      const difficulty = s.settings.promptDifficulty ?? 'normal'
      const text = s.mode === 'clarity'
        ? generateClarityPrompt(s.promptType as PromptMode, s.customPromptText)
        : generatePrompt(s.promptType as PromptMode, s.duration, s.customPromptText, difficulty)
      s.setPrompt(splitPrompt(text))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (store.testState === 'idle') loadPrompt()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.promptType, store.duration, store.mode])

  useEffect(() => {
    if (store.prompt.length === 0) loadPrompt()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStart = useCallback(async () => {
    setStartError(null)
    setPendingLeaderboardScore(null)

    const sStore = useTestStore.getState()
    const todayStr = getLocalDateStr()
    if (sStore.promptType === 'daily' && sStore.settings.lastStartedDailyChallengeDate === todayStr) {
      setStartError("You've already started today's challenge! Only one attempt allowed.")
      return
    }

    if (store.prompt.length === 0) loadPrompt()

    if (store.mode !== 'clarity') {
      resetProvider()
      store.setMicState('requesting')

      const didStart = await startSession()
      if (!didStart.ok) {
        const denied = didStart.error?.toLowerCase().includes('permission denied')
        store.setMicState(denied ? 'denied' : 'idle')
        const providerLabel = activeSource === 'deepgram' ? 'Deepgram' : 'Browser speech'
        setStartError(didStart.error ?? `${providerLabel} could not start. check mic access and try again`)
        return
      }

      if (store.promptType === 'daily') {
        store.updateSettings({ lastStartedDailyChallengeDate: todayStr })
      }

      const now = Date.now()
      store.startTest()
      setTestStartedAt(now)
      testStartedAtRef.current = now
      setDissolvedCount(0)
      setIsEnding(false)
      gameMetricsRef.current = { rawWpms: [] }
      timelineRef.current = []
      startTimer()
    } else {
      const now = Date.now()
      store.startTest()
      setTestStartedAt(now)
      testStartedAtRef.current = now
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.mode, store.prompt.length, loadPrompt, startSession, resetProvider, startTimer])

  const handleStop = useCallback(() => {
    const s = useTestStore.getState()
    if (s.mode !== 'clarity') {
      stopTimer()
      const elapsed = testStartedAtRef.current
        ? (Date.now() - testStartedAtRef.current) / 1000
        : s.duration
      finalizeSpeed(elapsed)
    } else {
      const promptStr = s.prompt.join(' ')
      const diff = diffWords(promptStr, s.clarityTranscript)
      const promptWordCount = promptStr.trim().split(/\s+/).filter(Boolean).length
      const { score, grade } = calcClarityScore(diff, promptWordCount)
      const punctuationScore = calcPunctuationScore(promptStr, s.clarityTranscript)
      
      const missedWordsList = diff
        .filter((w) => w.tag === 'missed' || w.tag === 'substituted')
        .map((w) => w.tag === 'substituted' ? (w.expected ?? w.word) : w.word)
        .map(w => w.toLowerCase().replace(/[^a-z0-9']/g, '').trim())
        .filter(Boolean)

      const spokenWordCount = s.clarityTranscript.trim().split(/\s+/).filter(Boolean).length

      s.setDiffResult(diff, score, grade)
      void submitClarityBenchmark({
        toolId: s.clarityToolId, toolName: s.clarityToolName, promptType: s.promptType,
        promptText: promptStr, transcript: s.clarityTranscript, clarityScore: score, punctuationScore,
      }).then(() => window.dispatchEvent(new Event('clarity-benchmark:refresh'))).catch(() => undefined)
      s.pushSessionHistory({
        date: new Date().toISOString(),
        mode: 'clarity',
        duration: 0,
        promptType: s.promptType,
        netWpm: 0,
        accuracy: score,
        fillerCount: 0,
        missedWords: missedWordsList,
        consistency: 0,
        wordsSpoken: spokenWordCount,
      })
      s.setTestState('ended')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopTimer, finalizeSpeed])

  // shared reset for run scratch state + stt so start paths stay in sync
  const clearRunScratch = useCallback(() => {
    setIsPersonalBest(false)
    setStartError(null)
    setPendingLeaderboardScore(null)
    setDissolvedCount(0)
    setIsEnding(false)
    gameMetricsRef.current = { rawWpms: [] }
    timelineRef.current = []
    setTestStartedAt(null)
    testStartedAtRef.current = null
    resetProvider()
  }, [resetProvider])

  const handleRetry = useCallback(() => {
    if (pendingLeaderboardScore) return
    clearRunScratch()
    const s = useTestStore.getState()
    s.resetTest()
    resetTimer(s.duration)
    const last = s.prompt.join(' ')
    const text = s.mode === 'clarity'
      ? generateClarityPrompt(s.promptType as PromptMode, s.customPromptText)
      : regeneratePrompt(s.promptType as PromptMode, s.duration, last, s.customPromptText, s.settings.promptDifficulty ?? 'normal')
    useTestStore.getState().setPrompt(splitPrompt(text))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearRunScratch, resetTimer, pendingLeaderboardScore])

  const handleNext = useCallback(() => {
    if (pendingLeaderboardScore) return
    clearRunScratch()
    const s = useTestStore.getState()
    const last = s.prompt.join(' ')
    s.resetTest()
    resetTimer(s.duration)
    const s2 = useTestStore.getState()
    const text = s2.mode === 'clarity'
      ? generateClarityPrompt(s2.promptType as PromptMode, s2.customPromptText)
      : regeneratePrompt(s2.promptType as PromptMode, s2.duration, last, s2.customPromptText, s2.settings.promptDifficulty ?? 'normal')
    s2.setPrompt(splitPrompt(text))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearRunScratch, resetTimer, pendingLeaderboardScore])

  const handlePractice = useCallback(() => {
    if (pendingLeaderboardScore) return
    clearRunScratch()
    const s = useTestStore.getState()
    const missedWords = (s.results?.diff ?? [])
      .filter((w) => w.tag === 'missed' || w.tag === 'substituted')
      .map((w) => w.tag === 'substituted' ? (w.expected ?? w.word) : w.word)
    s.resetTest()
    resetTimer(s.duration)
    const practiceText = generatePracticePrompt(missedWords, s.duration)
    useTestStore.getState().setPrompt(splitPrompt(practiceText))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearRunScratch, resetTimer, pendingLeaderboardScore])

  const handleStopRef = useRef(handleStop)
  useEffect(() => { handleStopRef.current = handleStop }, [handleStop])

  useEffect(() => {
    if (store.testState !== 'running' || store.mode === 'clarity') return
    if ((store.settings.endCondition ?? 'timer') !== 'passage') return
    if (store.prompt.length === 0 || dissolvedCount < store.prompt.length) return
    handleStopRef.current()
  }, [dissolvedCount, store.testState, store.mode, store.prompt.length, store.settings.endCondition])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return
      if (pendingLeaderboardScore) return

      if (e.key === 'Tab') {
        e.preventDefault()
        if (store.testState === 'running') handleStop()
        else if (store.testState === 'ended') handleRetry()
        else {
          clearRunScratch()
          store.resetTest()
          resetTimer(store.duration)
        }
      }

      if (e.key === 'Enter') {
        if (store.testState === 'ended') { e.preventDefault(); handleNext() }
        else if (store.testState === 'idle') { e.preventDefault(); handleStart() }
      }

      if (e.key === 'Escape' && store.testState === 'running') {
        e.preventDefault()
        handleStop()
      }

      if (e.ctrlKey && e.key === ',') { e.preventDefault(); setSettingsOpen((o) => !o) }
      if (e.ctrlKey && e.key === 'p') { e.preventDefault(); setProfileOpen((o) => !o) }
      if (e.ctrlKey && e.key === '1') { e.preventDefault(); store.setMode('speed') }
      if (e.ctrlKey && e.key === '2') { e.preventDefault(); store.setMode('clarity') }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.testState, store.duration, handleRetry, handleNext, handleStop, handleStart, resetTimer, clearRunScratch, pendingLeaderboardScore, setProfileOpen])

  // dismiss the badge-unlocked modal with Escape
  useEffect(() => {
    if (unlockedBadgeNames.length === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setUnlockedBadgeNames([])
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [unlockedBadgeNames.length])

  // hero entrance
  useEffect(() => {
    if (!heroRef.current || store.testState !== 'idle') return
    const ctx = gsap.context(() => {
      gsap.from('.hero-animate', {
        opacity: 0,
        y: 24,
        stagger: 0.1,
        duration: 0.6,
        ease: 'power3.out',
      })
    }, heroRef)
    return () => ctx.revert()
  }, [store.testState, store.mode])

  const isRunning = store.testState === 'running'
  const isEnded   = store.testState === 'ended'
  const isIdle    = store.testState === 'idle'
  const elapsedMs = store.duration * 1000 - timeRemaining
  const ghostBest = store.settings.personalBests[`speed-${store.duration}s-${store.promptType}`]
  const ghostProgressAt = (elapsedSeconds: number) => {
    const points = ghostBest?.timeline?.progress ?? []
    if (!points.length || !store.prompt.length) return Math.min(100, (elapsedSeconds / store.duration) * 100)
    const prior = [...points].reverse().find((point) => point.second <= elapsedSeconds) ?? points[0]
    return Math.min(100, ((prior?.words ?? 0) / store.prompt.length) * 100)
  }
  const startHint = store.settings.sttProvider === 'deepgram'
    ? 'before you start: allow the mic, read the text out loud, and keep a steady pace.'
    : 'before you start: allow the mic, read the text out loud, and speak naturally. chrome usually works best for browser speech.'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <Header onSettingsOpen={() => setSettingsOpen(true)} onProfileOpen={() => setProfileOpen(true)} />

      {isIdle && <ConfigBar />}

      {isRunning && store.mode === 'clarity' && (
        <StatsBar
          mode={store.mode}
          wordCount={store.clarityTranscript.trim().split(/\s+/).filter(Boolean).length}
          timeRemainingMs={timeRemaining}
          isWarning={isWarning}
          micState={store.micState}
        />
      )}

      <main
        className={`flex-1 flex flex-col items-center px-6 py-8 mx-auto w-full ${
          store.mode !== 'clarity' ? (isIdle ? 'max-w-[1320px]' : 'max-w-[900px]') : 'max-w-none'
        } ${isIdle ? 'justify-start' : 'justify-center'}`}
      >
        {!isEnded ? (
          <div className="relative w-full flex flex-col items-stretch">
            {store.mode !== 'clarity' ? (
              <div className="flex flex-col w-full gap-8">
                {/* idle hero */}
                {isIdle && store.mode === 'speed' && (
                  <div
                    ref={heroRef}
                    className="hero-shell hero-stage"
                    data-mic-hovered={micHovered ? 'true' : 'false'}
                  >
                    <HeroLeaderboard />
                    <section className="hero-center-copy" aria-label="MonkeySpeak start">
                    {store.promptType === 'daily' && store.settings.lastStartedDailyChallengeDate === getLocalDateStr() ? (
                      <div className="hero-stage-content note-panel flex flex-col items-center justify-center text-center p-6 gap-4 max-w-md w-full">
                        <span className="text-3xl animate-bounce">🔒</span>
                        <h2 className="font-display font-black text-lg" style={{ color: 'var(--text-active)' }}>
                          daily challenge completed
                        </h2>
                        <p className="stats-page-subtitle leading-normal max-w-xs">
                          {"One date, one seed, one attempt. You've already taken today's challenge. Come back tomorrow!"}
                        </p>
                        <Link href="/leaderboard#stats" className="desk-btn desk-btn-primary text-xs py-2 px-4">
                          view your stats
                        </Link>
                      </div>
                    ) : (
                      <>
                        <div className="hero-stage-content">
                          <div className="hero-animate hero-title-block">
                            <h1 className="hero-title font-display font-black">
                              <span className="hero-title-line">
                                how fast<span className="hero-title-accent">⚡</span>can u
                              </span>
                              <span className="hero-title-line hero-title-line--speak">
                                speak<span className="hero-title-emoji" aria-hidden>🙊</span>
                              </span>
                            </h1>
                            <p className="hero-subtitle font-mono">
                              read it. say it.{' '}
                              <span className="hero-subtitle-highlight">beat your score.</span>
                            </p>
                            {calculateSpeakingStreak(store.settings.speakingActivity) > 0 && (
                              <div className="hero-animate inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-solid border-[var(--border)] bg-[var(--surface)] text-[var(--accent)] font-mono text-xs mt-2 select-none w-fit">
                                <span>🔥 {calculateSpeakingStreak(store.settings.speakingActivity)} day streak</span>
                              </div>
                            )}
                            <p className="hero-animate start-hint font-mono mt-3">
                              {store.promptType === 'daily'
                                ? 'daily challenge: one attempt per day. read the prompt, hit start, and go.'
                                : startHint}
                            </p>
                          </div>

                          <CapabilityBanner />

                          {startError && (
                            <div
                              role="alert"
                              className="hero-animate note-panel alert-note px-4 py-3 flex items-center justify-between gap-4 w-full max-w-md"
                            >
                              <span className="font-mono">{startError}</span>
                              <button
                                onClick={() => setStartError(null)}
                                aria-label="Dismiss error"
                                className="plain-icon-btn"
                              >
                                x
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="hero-cta-zone hero-animate">
                          <HeroMonkey
                            onStart={handleStart}
                            micState={store.micState}
                            onHoverChange={setMicHovered}
                          />
                        </div>
                      </>
                    )}
                    </section>

                    <div className="hero-side-stack hero-animate">
                      <HeroTopScore />
                      <HeroDailyGoal />
                      <HeroQuickTips />
                    </div>
                  </div>
                )}

                {isIdle && store.mode === 'ghost' && (() => {
                  return <GhostRace phase="idle" playerProgress={0} ghostProgress={0} playerWpm={0} ghostWpm={ghostBest?.wpm ?? 0} duration={store.duration} onStart={handleStart} />
                })()}

                {/* running live test */}
                {(isRunning || isEnding) && (
                  <>
                    {sttError && (
                      <div
                        role="alert"
                        className="note-panel alert-note px-4 py-3 flex items-center justify-between gap-4 w-full mb-4"
                      >
                        <span className="font-mono">{sttError}</span>
                      </div>
                    )}
                    <SpeakingGame
                      words={store.prompt}
                      timeRemainingMs={timeRemaining}
                      totalDurationMs={store.duration * 1000}
                      dissolvedCount={dissolvedCount}
                      micStream={micStream}
                      waveActivity={waveActivity}
                      speechActive={speechActive}
                      game={speakingGame}
                      timelineRef={timelineRef}
                      isEnding={isEnding}
                      activeSource={activeSource}
                      isListening={isListening}
                      sttError={sttError}
                      endCondition={endCondition}
                      elapsedMs={elapsedMs}
                    />
                    {store.mode === 'ghost' && (() => {
                      const playerProgress = store.prompt.length ? (dissolvedCount / store.prompt.length) * 100 : 0
                      const ghostProgress = ghostProgressAt(elapsedMs / 1000)
                      return <GhostRace phase="running" playerProgress={playerProgress} ghostProgress={ghostProgress} playerWpm={Math.round(speakingGame.liveWpm)} ghostWpm={ghostBest?.wpm ?? 0} duration={store.duration} />
                    })()}
                  </>
                )}
              </div>
            ) : (
              <ClarityInput
                testState={store.testState}
                transcript={store.clarityTranscript}
                diffResult={store.diffResult}
                prompt={store.prompt}
                onChange={(val) => store.setClarityTranscript(val)}
                onStop={handleStop}
                onStart={(tool) => { store.setClarityTool(tool.id, tool.name); void handleStart() }}
              />
            )}
          </div>
        ) : (
          <ResultsPanel
            mode={store.mode === 'clarity' ? 'clarity' : 'speed'}
            results={store.results}
            duration={store.duration}
            promptType={store.promptType}
            prompt={store.prompt}
            clarityScore={store.clarityScore}
            clarityGrade={store.clarityGrade}
            diffResult={store.diffResult}
            isPersonalBest={isPersonalBest}
            personalBestWpm={store.settings.personalBests[`speed-${store.duration}s-${store.promptType}`]?.wpm}
            onRetry={handleRetry}
            onNext={handleNext}
            onPractice={handlePractice}
          />
        )}
      </main>

      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ProfileHub isOpen={profileOpen} onClose={() => setProfileOpen(false)} />

      {/* Badge Unlocked Notification Modal */}
      {unlockedBadgeNames.length > 0 && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          role="presentation"
          onClick={() => setUnlockedBadgeNames([])}
        >
          <div
            className="paper-panel p-6 text-center flex flex-col items-center gap-4 max-w-sm w-full max-h-[85vh]"
            role="dialog"
            aria-modal="true"
            aria-label="Badge unlocked"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-2xl animate-bounce">🐵✨</p>
            <h2 className="font-display font-black text-xl" style={{ color: 'var(--text-active)' }}>
              badge unlocked!
            </h2>
            <p className="stats-page-subtitle">
              You unlocked:
            </p>
            <div className="flex flex-col gap-2 w-full overflow-y-auto min-h-0">
              {unlockedBadgeNames.map((name) => (
                <div
                  key={name}
                  className="small-chip justify-center font-semibold"
                  style={{ color: 'var(--accent)' }}
                >
                  🏆 {name}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setUnlockedBadgeNames([])}
              className="desk-btn desk-btn-primary text-xs mt-2"
            >
              collect sticker
            </button>
          </div>
        </div>
      )}

      <LeaderboardSavePrompt
        score={pendingLeaderboardScore}
        onClose={() => setPendingLeaderboardScore(null)}
        onSaved={() => {
          window.dispatchEvent(new Event('leaderboard:refresh'))
        }}
      />
      <Toast message={fallbackMessage} onDismiss={clearFallbackMessage} />
    </div>
  )
}
