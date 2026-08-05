'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTestStore, type Duration, type PromptType } from '@/store/testStore'
import { useTimer } from '@/hooks/useTimer'
import { useActiveSpeechProvider } from '@/hooks/useActiveSpeechProvider'
import { useSpeakingGame } from '@/hooks/useSpeakingGame'
import { generatePrompt, regeneratePrompt, generatePracticePrompt, generateDailyPrompt, type PromptMode } from '@/lib/prompts'
import { getLocalDateStr } from '@/lib/stats/streak'
import { alignTranscriptToPrompt, countFillers } from '@/lib/alignTranscriptToPrompt'
import { netWpmFromChars, rawWpmFromChars } from '@/lib/stats/wpm'
import { computeConsistency } from '@/lib/stats/consistency'
import { buildSessionTimeline, type TimelineSample } from '@/lib/stats/timeline'

export type PendingLeaderboardScore = {
  wpm: number
  accuracy: number
  duration: Duration
  promptType: PromptType
  elapsedSec: number
  runToken: string
}

export function splitPrompt(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

export function useSpeedTestController() {
  const store = useTestStore()
  const [unlockedBadgeNames, setUnlockedBadgeNames] = useState<string[]>([])
  const [isPersonalBest, setIsPersonalBest] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [dissolvedCount, setDissolvedCount] = useState(0)
  const [isEnding, setIsEnding] = useState(false)
  const [pendingLeaderboardScore, setPendingLeaderboardScore] = useState<PendingLeaderboardScore | null>(null)
  const [fillerFlashTick, setFillerFlashTick] = useState(0)

  const gameMetricsRef = useRef({ rawWpms: [] as number[] })
  const timelineRef = useRef<TimelineSample[]>([])
  const [testStartedAt, setTestStartedAt] = useState<number | null>(null)
  const testStartedAtRef = useRef<number | null>(null)
  const confirmedWordsRef = useRef<string[]>([])
  const interimTextRef = useRef('')
  const finalizingRef = useRef(false)
  const runTokenRef = useRef<string | null>(null)
  const prevFillerCountRef = useRef(0)

  const sttProvider = store.settings.sttProvider ?? 'webspeech'
  const endCondition = store.settings.endCondition ?? 'timer'

  const activeStt = useActiveSpeechProvider(sttProvider)
  const {
    interimText,
    previewWords,
    confirmedWords,
    fillerCount: liveFillerCount,
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
  } = activeStt

  const speechActive =
    Boolean(audioActive) ||
    previewWords.length > 0 ||
    interimText.trim().length > 0 ||
    (isListening && confirmedWords.length > 0)

  const waveActivity = (() => {
    if (audioActive) return 0.9
    if (previewWords.length > 0 || interimText.trim().length > 0) return 0.72
    if (isListening && confirmedWords.length > 0) return 0.55
    return 0
  })()

  useEffect(() => { confirmedWordsRef.current = confirmedWords }, [confirmedWords])
  useEffect(() => { interimTextRef.current = interimText }, [interimText])

  useEffect(() => {
    if (liveFillerCount > prevFillerCountRef.current) {
      setFillerFlashTick((n) => n + 1)
    }
    prevFillerCountRef.current = liveFillerCount
  }, [liveFillerCount])

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

  const finalizeSpeed = useCallback((elapsedSec: number) => {
    if (finalizingRef.current) return
    const state = useTestStore.getState()
    if (state.testState !== 'running') return
    finalizingRef.current = true

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

    const safeElapsed = Math.max(1, Math.min(elapsedSec, resultDuration + 2))
    const diff = alignTranscriptToPrompt(fullTranscript, s.prompt)
    const fillerCount = Math.max(liveFillerCount, countFillers(fullTranscript, s.prompt))

    const correctWords = diff.filter((w) => w.tag === 'correct')
    const correctChars = correctWords.reduce((sum, w) => sum + w.word.length + 1, 0)
    const allSpokenWords = diff.filter((w) => w.tag !== 'missed')
    const allSpokenChars = allSpokenWords.reduce((sum, w) => sum + w.word.length + 1, 0)

    const netWpm = netWpmFromChars(correctChars, safeElapsed)
    const rawWpm = rawWpmFromChars(allSpokenChars, safeElapsed)
    const accuracy = s.prompt.length > 0
      ? Math.round((correctWords.length / s.prompt.length) * 100)
      : 0

    const timeline = buildSessionTimeline(timelineRef.current, diff)
    const pbKey = `speed-${s.duration}s-${s.promptType}`
    const ghostWpmBefore = s.settings.personalBests[pbKey]?.wpm ?? 0
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
        elapsedSec: safeElapsed,
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
      if (s.mode === 'ghost') {
        s.pushGhostRace({
          date: new Date().toISOString(),
          duration: resultDuration,
          promptType: activeDailyKey,
          playerWpm: netWpm,
          ghostWpm: ghostWpmBefore,
          won: ghostWpmBefore > 0 && netWpm >= ghostWpmBefore,
          marginWpm: netWpm - ghostWpmBefore,
        })
      }
      s.setTestState('ended')
      const runToken = runTokenRef.current
      if (runToken && safeElapsed >= resultDuration * 0.9) {
        setPendingLeaderboardScore({
          wpm: netWpm,
          accuracy,
          duration: resultDuration,
          promptType: activeDailyKey as PromptType,
          elapsedSec: safeElapsed,
          runToken,
        })
      } else {
        setPendingLeaderboardScore(null)
      }
      setIsEnding(false)
    }, 1200)
  }, [stopSession, liveFillerCount])

  const handleTimerEnd = useCallback(() => {
    if (useTestStore.getState().settings.endCondition === 'passage') return
    const elapsed = testStartedAtRef.current
      ? (Date.now() - testStartedAtRef.current) / 1000
      : store.duration
    finalizeSpeed(Math.min(elapsed, store.duration))
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
        ? generatePrompt(s.promptType as PromptMode, s.duration, s.customPromptText, difficulty)
        : generatePrompt(s.promptType as PromptMode, s.duration, s.customPromptText, difficulty)
      s.setPrompt(splitPrompt(text))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clearRunScratch = useCallback(() => {
    setIsPersonalBest(false)
    setStartError(null)
    setPendingLeaderboardScore(null)
    setDissolvedCount(0)
    setIsEnding(false)
    finalizingRef.current = false
    runTokenRef.current = null
    prevFillerCountRef.current = 0
    gameMetricsRef.current = { rawWpms: [] }
    timelineRef.current = []
    setTestStartedAt(null)
    testStartedAtRef.current = null
    resetProvider()
  }, [resetProvider])

  const handleStart = useCallback(async () => {
    setStartError(null)
    setPendingLeaderboardScore(null)
    finalizingRef.current = false
    runTokenRef.current = null
    prevFillerCountRef.current = 0

    const sStore = useTestStore.getState()
    const todayStr = getLocalDateStr()
    if (sStore.promptType === 'daily' && sStore.settings.lastStartedDailyChallengeDate === todayStr) {
      setStartError("You've already started today's challenge! Only one attempt allowed.")
      return
    }

    if (store.prompt.length === 0) loadPrompt()

    resetProvider()
    store.setMicState('requesting')

    try {
      const tokenRes = await fetch('/api/run-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration: sStore.duration,
          promptType: sStore.promptType === 'daily' ? `daily-${todayStr}` : sStore.promptType,
        }),
      })
      const tokenData = (await tokenRes.json().catch(() => ({}))) as { runToken?: string; error?: string }
      if (tokenRes.ok && tokenData.runToken) {
        runTokenRef.current = tokenData.runToken
      }
    } catch {
      /* board save skipped without token */
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.prompt.length, loadPrompt, startSession, resetProvider, startTimer, activeSource])

  const handleStop = useCallback(() => {
    stopTimer()
    const elapsed = testStartedAtRef.current
      ? (Date.now() - testStartedAtRef.current) / 1000
      : store.duration
    finalizeSpeed(elapsed)
  }, [stopTimer, finalizeSpeed, store.duration])

  const handleRetry = useCallback(() => {
    if (pendingLeaderboardScore) return
    clearRunScratch()
    const s = useTestStore.getState()
    s.resetTest()
    resetTimer(s.duration)
    const last = s.prompt.join(' ')
    const text = regeneratePrompt(s.promptType as PromptMode, s.duration, last, s.customPromptText, s.settings.promptDifficulty ?? 'normal')
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
    const text = regeneratePrompt(s2.promptType as PromptMode, s2.duration, last, s2.customPromptText, s2.settings.promptDifficulty ?? 'normal')
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
    if (store.prompt.length === 0 || speakingGame.currentIndex < store.prompt.length) return
    handleStopRef.current()
  }, [speakingGame.currentIndex, store.testState, store.mode, store.prompt.length, store.settings.endCondition])

  return {
    timeRemaining,
    isWarning,
    startTimer,
    stopTimer,
    resetTimer,
    startError,
    setStartError,
    dissolvedCount,
    isEnding,
    isPersonalBest,
    pendingLeaderboardScore,
    setPendingLeaderboardScore,
    unlockedBadgeNames,
    setUnlockedBadgeNames,
    fillerFlashTick,
    speakingGame,
    timelineRef,
    speechActive,
    waveActivity,
    micStream,
    activeSource,
    isListening,
    sttError,
    fallbackMessage,
    clearFallbackMessage,
    endCondition,
    handleStart,
    handleStop,
    handleRetry,
    handleNext,
    handlePractice,
    clearRunScratch,
    loadPrompt,
  }
}
