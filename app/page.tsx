'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { useTestStore } from '@/store/testStore'
import { useTimer } from '@/hooks/useTimer'
import { useActiveSpeechProvider } from '@/hooks/useActiveSpeechProvider'
import { generatePrompt, regeneratePrompt, generatePracticePrompt, type PromptMode } from '@/lib/prompts'
import { diffWords, calcClarityScore } from '@/lib/diff'
import { alignAsrFinalToPrompt } from '@/lib/asrPromptAlign'
import { netWpmFromChars, rawWpmFromChars, perWordRawWpm } from '@/lib/stats/wpm'
import { useSpeculativeMatch } from '@/hooks/useSpeculativeMatch'
import type { EnrichedWord } from '@/hooks/useSpeechProvider'

import Header from '@/components/Header'
import ConfigBar from '@/components/ConfigBar'
import StatsBar from '@/components/StatsBar'
import TestArea from '@/components/TestArea'
import FillerFlash from '@/components/FillerFlash'
import MicButton from '@/components/MicButton'
import ClarityInput from '@/components/ClarityInput'
import ResultsPanel from '@/components/ResultsPanel'
import SettingsPanel from '@/components/SettingsPanel'
import WaveformVisualiser from '@/components/WaveformVisualiser'

function splitPrompt(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

/** 2–1 arming: recognition runs but scoring/timer wait until max(armEnd, firstSpeech). */
const SPEED_ARMING_MS = 0
const SPEED_NO_SPEECH_WATCHDOG_MS = 25_000

export default function Home() {
  const store = useTestStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [waveformErrorFlash, setWaveformErrorFlash] = useState(false)
  const [isPersonalBest, setIsPersonalBest] = useState(false)
  const startTimeRef = useRef<number | null>(null)
  const errorFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevFillerCountRef = useRef(0)
  const scoringFrozenRef = useRef(false)
  const firstSpeechTsRef = useRef<number | null>(null)
  const armingEndTsRef = useRef<number | null>(null)
  const armTimerIdsRef = useRef<Array<number | ReturnType<typeof setTimeout>>>([])
  const prevConfirmedLenRef = useRef(0)
  const prevEnrichedLenRef = useRef(0)
  const pendingConfirmedWordsRef = useRef<EnrichedWord[]>([])
  const handleStopRef = useRef<() => void>(() => {})
  // Optimistic advancement: tracks how many words were advanced before DG final
  const optimisticCountRef = useRef(0)
  // Tracks currentWordIndex before any optimistic advances in the current interim window
  const optimisticBaseIndexRef = useRef(0)
  const [armingCountdown, setArmingCountdown] = useState<number | null>(null)

  // ── Active STT provider (always both mounted; selector picks one) ──────────
  const sttProvider = store.settings.sttProvider ?? 'webspeech'
  const {
    interimText,
    confirmedWords,
    enrichedWords,
    fillerCount,
    isListening,
    error: sttError,
    micStream,
    armSession,
    startSession,
    stopSession,
    reset: resetProvider,
    onSpeechStart,
  } = useActiveSpeechProvider(sttProvider)

  // Page-level speculative match — drives optimistic word advancement.
  // Mirrors the inputs passed to TestArea so decisions stay in sync.
  const isRunning = store.testState === 'running'
  const confirmedStringsForSpec = store.confirmedWords.map((c) => c.word)
  const pageWordStates = useSpeculativeMatch({
    promptWords: store.prompt,
    confirmedWords: confirmedStringsForSpec,
    interimText: isRunning && store.mode === 'speed' ? interimText : '',
  })

  const clearSpeedArmingTimers = useCallback(() => {
    for (const id of armTimerIdsRef.current) clearTimeout(id)
    armTimerIdsRef.current = []
  }, [])

  const triggerWaveformError = useCallback(() => {
    if (errorFlashTimeoutRef.current !== null) clearTimeout(errorFlashTimeoutRef.current)
    setWaveformErrorFlash(true)
    errorFlashTimeoutRef.current = setTimeout(() => {
      setWaveformErrorFlash(false)
      errorFlashTimeoutRef.current = null
    }, 600)
  }, [])

  useEffect(
    () => () => {
      if (errorFlashTimeoutRef.current !== null) clearTimeout(errorFlashTimeoutRef.current)
    },
    []
  )

  // ── Restore persisted settings to DOM on mount ────────────────────────────
  useEffect(() => {
    const { settings } = store
    const html = document.documentElement
    import('@/lib/themes').then(({ THEMES, applyTheme }) => {
      const theme = THEMES[settings.theme] ?? THEMES.mocha
      applyTheme(theme, settings.accentHex)
    })
    html.dataset.font = settings.font
    html.dataset.fontsize = settings.fontSize
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Timer ─────────────────────────────────────────────────────────────────
  // Defined before handleTimerEnd so the timer-end callback can flush a final
  // WPM snapshot before evaluating the personal-best threshold.
  const flushSpeedWpmSnapshot = useCallback(() => {
    const t0 = startTimeRef.current
    if (t0 == null) return
    const s = useTestStore.getState()
    if (s.mode !== 'speed') return
    const elapsedMs = Date.now() - t0
    if (elapsedMs < 3000) return
    const correctWords = s.confirmedWords.filter((w) => w.isCorrect)
    const correctChars = correctWords.reduce((sum, w) => sum + w.word.length + 1, 0)
    const allChars = s.confirmedWords.reduce((sum, w) => sum + w.word.length + 1, 0)
    const computed = netWpmFromChars(correctChars, elapsedMs / 1000)
    s.setWpm(computed)
    s.setRawWpm(rawWpmFromChars(allChars, elapsedMs / 1000))
    if (computed > s.peakWpm) s.setPeakWpm(computed)
    s.addWpmSnapshot({ wpm: computed, timestamp: Date.now() })
  }, [])

  const handleTimerEnd = useCallback(() => {
    clearSpeedArmingTimers()
    setArmingCountdown(null)
    armingEndTsRef.current = null
    firstSpeechTsRef.current = null
    scoringFrozenRef.current = false
    // Flush the final WPM snapshot so the personal-best check uses
    // accurate values rather than whatever the 150 ms interval last wrote.
    flushSpeedWpmSnapshot()
    store.finaliseConsistency()
    const s = useTestStore.getState()
    const pbKey = `speed-${s.duration}s-${s.promptType}`
    const newBest = s.checkAndUpdatePersonalBest(pbKey, s.wpm)
    setIsPersonalBest(newBest)
    store.setTestState('ended')
    stopSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSpeedArmingTimers, stopSession, flushSpeedWpmSnapshot])

  const { timeRemaining, isWarning, start: startTimer, stop: stopTimer, reset: resetTimer } =
    useTimer(store.duration, handleTimerEnd)

  const flushPendingConfirmedWords = useCallback(() => {
    const pending = pendingConfirmedWordsRef.current
    if (pending.length === 0) return

    const s = useTestStore.getState()
    if (s.testState !== 'running' || s.mode !== 'speed') return

    pendingConfirmedWordsRef.current = []
    optimisticCountRef.current = 0
    optimisticBaseIndexRef.current = 0
    const { prompt, currentWordIndex, addWord, advanceWord, detectFiller } = s
    const batch = alignAsrFinalToPrompt(pending, prompt, currentWordIndex, () => {
      detectFiller()
    })

    for (const result of batch) {
      if (!result.isCorrect) triggerWaveformError()
      addWord(result)
      advanceWord()
      if (result.isCorrect && result.endTime != null) {
        const cur = useTestStore.getState()
        const prev = cur.lastCorrectWordEndTime
        const delta = prev != null ? result.endTime - prev : result.endTime
        if (delta > 0) {
          cur.pushWordRawWpm(perWordRawWpm(result.word.length, delta))
        }
        cur.setLastCorrectWordEndTime(result.endTime)
      }
    }
  }, [triggerWaveformError])

  const tryCommitSpeedEpoch = useCallback(() => {
    const s = useTestStore.getState()
    if (s.testState !== 'running' || s.mode !== 'speed') return
    if (s.speedClockStartedAt != null) return
    const armEnd = armingEndTsRef.current
    if (armEnd != null && Date.now() < armEnd) return
    const now = Date.now()
    const epoch =
      armEnd != null
        ? Math.max(armEnd, firstSpeechTsRef.current ?? now)
        : (firstSpeechTsRef.current ?? now)
    useTestStore.getState().setSpeedClockStartedAt(epoch)
    startTimeRef.current = epoch
    scoringFrozenRef.current = false
    startTimer()
    flushPendingConfirmedWords()
  }, [startTimer, flushPendingConfirmedWords])

  // ── VAD epoch binding ─────────────────────────────────────────────────────
  // Register the VAD speech_start callback once on mount so the first voiced
  // frame (~32ms latency) sets firstSpeechTsRef, ~200ms earlier than waiting
  // for the first confirmed word batch from Deepgram.
  useEffect(() => {
    onSpeechStart?.((ts) => {
      const s = useTestStore.getState()
      if (s.testState !== 'running' || s.mode !== 'speed') return
      if (firstSpeechTsRef.current == null) {
        firstSpeechTsRef.current = ts
        armingEndTsRef.current = null
        tryCommitSpeedEpoch()
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSpeechStart])

  // ── Optimistic word advancement ───────────────────────────────────────────
  // When the speculative match is stable at currentWordIndex AND the next word
  // has also started appearing, we have high confidence the current word was
  // spoken correctly. Advance immediately rather than waiting for is_final.
  // The DG final handler reconciles and patches any mismatches afterward.
  useEffect(() => {
    const s = useTestStore.getState()
    if (s.testState !== 'running' || s.mode !== 'speed') return
    if (s.speedClockStartedAt == null) return
    if (!interimText) return
    // Cap to avoid over-advancing on fast bursts
    if (optimisticCountRef.current >= 2) return

    const cwi = s.currentWordIndex
    const current = pageWordStates[cwi]
    const next = pageWordStates[cwi + 1]

    if (
      current?.status === 'speculative' &&
      next !== undefined &&
      next.status !== 'pending'
    ) {
      const promptWord = s.prompt[cwi]
      if (!promptWord) return
      // Record base index on the first optimistic advance in this interim window
      if (optimisticCountRef.current === 0) {
        optimisticBaseIndexRef.current = cwi
      }
      s.optimisticAdvanceWord({
        word: promptWord,
        isCorrect: true,
        isFiller: false,
        timestamp: Date.now(),
      })
      optimisticCountRef.current++
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageWordStates, interimText])

  // ── confirmedWords → store (provider feeds us the array) ─────────────────
  // Track the previous length so we only process new entries each render.
  // enrichedWords is parallel to confirmedWords — same index, same length for
  // Deepgram; always empty [] for WebSpeech. We use it to pass per-word timing
  // and confidence through to the aligner.
  useEffect(() => {
    const s = useTestStore.getState()
    if (s.testState !== 'running' || s.mode !== 'speed') return

    const newWords = confirmedWords.slice(prevConfirmedLenRef.current)
    prevConfirmedLenRef.current = confirmedWords.length

    // Slice enrichedWords by the same window. Falls back to word-only objects
    // when enrichedWords is empty (WebSpeech provider).
    const newEnriched = enrichedWords.slice(prevEnrichedLenRef.current)
    prevEnrichedLenRef.current = enrichedWords.length

    if (newWords.length === 0) return

    // Build the EnrichedWord[] that the aligner consumes. Use Deepgram's
    // enriched objects when available; otherwise wrap bare strings.
    const tokensForAligner: EnrichedWord[] =
      newEnriched.length === newWords.length
        ? newEnriched
        : newWords.map((w) => ({ word: w }))

    // Detect first-speech epoch
    if (firstSpeechTsRef.current == null) {
      firstSpeechTsRef.current = Date.now()
      armingEndTsRef.current = null
      tryCommitSpeedEpoch()
    }

    if (scoringFrozenRef.current || s.speedClockStartedAt == null) {
      pendingConfirmedWordsRef.current.push(...tokensForAligner)
      return
    }

    const optimisticCount = optimisticCountRef.current
    const optimisticBase = optimisticBaseIndexRef.current

    // Align starting at the pre-optimistic word index so the aligner covers
    // both the already-advanced optimistic words and any new words beyond them.
    const alignStartIndex = optimisticCount > 0 ? optimisticBase : s.currentWordIndex

    const { prompt, addWord, advanceWord, detectFiller, patchWord } = s
    const batch = alignAsrFinalToPrompt(tokensForAligner, prompt, alignStartIndex, () => {
      detectFiller()
    })

    // ── Reconcile optimistic words then process remainder ─────────────────
    for (let i = 0; i < batch.length; i++) {
      const result = batch[i]!
      const storeIndex = alignStartIndex + i

      if (i < optimisticCount) {
        // This position was already advanced optimistically — reconcile.
        if (!result.isCorrect) {
          triggerWaveformError()
          patchWord(storeIndex, {
            word: result.word,
            isCorrect: false,
            isOptimistic: false,
            startTime: result.startTime,
            endTime: result.endTime,
            confidence: result.confidence,
          })
        } else {
          // Confirm the optimistic word (clear flag, update timing from DG)
          patchWord(storeIndex, {
            isOptimistic: false,
            startTime: result.startTime,
            endTime: result.endTime,
            confidence: result.confidence,
          })
          if (result.endTime != null) {
            const cur = useTestStore.getState()
            const prev = cur.lastCorrectWordEndTime
            const delta = prev != null ? result.endTime - prev : result.endTime
            if (delta > 0) cur.pushWordRawWpm(perWordRawWpm(result.word.length, delta))
            cur.setLastCorrectWordEndTime(result.endTime)
          }
        }
      } else {
        // New word beyond optimistic window — process normally.
        if (!result.isCorrect) triggerWaveformError()
        addWord(result)
        advanceWord()
        if (result.isCorrect && result.endTime != null) {
          const cur = useTestStore.getState()
          const prev = cur.lastCorrectWordEndTime
          const delta = prev != null ? result.endTime - prev : result.endTime
          if (delta > 0) cur.pushWordRawWpm(perWordRawWpm(result.word.length, delta))
          cur.setLastCorrectWordEndTime(result.endTime)
        }
      }
    }

    optimisticCountRef.current = 0
    optimisticBaseIndexRef.current = 0
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmedWords, enrichedWords])

  // ── fillerCount → store ───────────────────────────────────────────────────
  useEffect(() => {
    const delta = fillerCount - prevFillerCountRef.current
    prevFillerCountRef.current = fillerCount
    if (delta <= 0) return
    const s = useTestStore.getState()
    if (s.testState !== 'running' || s.mode !== 'speed') return
    for (let i = 0; i < delta; i++) {
      s.detectFiller()
      triggerWaveformError()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fillerCount])

  // ── First speech detection (for arming epoch) ─────────────────────────────
  // We watch isListening + interimText appearing together as a proxy for first audio
  const firstSpeechFiredRef = useRef(false)
  useEffect(() => {
    if (!interimText || firstSpeechFiredRef.current) return
    const s = useTestStore.getState()
    if (s.testState !== 'running' || s.mode !== 'speed') return
    firstSpeechFiredRef.current = true
    if (firstSpeechTsRef.current == null) {
      firstSpeechTsRef.current = Date.now()
      armingEndTsRef.current = null
      tryCommitSpeedEpoch()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interimText])

  // ── WPM tracking on confirmedWords change ─────────────────────────────────
  useEffect(() => {
    const s = useTestStore.getState()
    if (s.testState !== 'running' || s.mode !== 'speed') return
    if (!startTimeRef.current) return
    const elapsedMs = Date.now() - startTimeRef.current
    if (elapsedMs < 3000) return
    const correctWords = s.confirmedWords.filter((w) => w.isCorrect)
    const correctChars = correctWords.reduce((sum, w) => sum + w.word.length + 1, 0)
    const allChars = s.confirmedWords.reduce((sum, w) => sum + w.word.length + 1, 0)
    const computed = netWpmFromChars(correctChars, elapsedMs / 1000)
    s.setWpm(computed)
    s.setRawWpm(rawWpmFromChars(allChars, elapsedMs / 1000))
    if (computed > s.peakWpm) s.setPeakWpm(computed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.confirmedWords.length])

  // ── WPM interval ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (store.testState !== 'running' || store.mode !== 'speed') return
    const id = setInterval(() => {
      if (!startTimeRef.current) return
      const s = useTestStore.getState()
      if (s.testState !== 'running' || s.mode !== 'speed') return
      const elapsedMs = Date.now() - startTimeRef.current
      if (elapsedMs < 3000) return
      const correctWords = s.confirmedWords.filter((w) => w.isCorrect)
      const correctChars = correctWords.reduce((sum, w) => sum + w.word.length + 1, 0)
      const allChars = s.confirmedWords.reduce((sum, w) => sum + w.word.length + 1, 0)
      const computed = netWpmFromChars(correctChars, elapsedMs / 1000)
      s.setWpm(computed)
      s.setRawWpm(rawWpmFromChars(allChars, elapsedMs / 1000))
      if (computed > s.peakWpm) s.setPeakWpm(computed)
      s.addWpmSnapshot({ wpm: computed, timestamp: Date.now() })
    }, 150)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.testState, store.mode])

  // ── STT error → mic state ─────────────────────────────────────────────────
  useEffect(() => {
    if (sttError) store.setMicState('error')
    else if (isListening) store.setMicState('active')
    else store.setMicState('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sttError, isListening])

  // ── Prompt management ─────────────────────────────────────────────────────
  const loadPrompt = useCallback(() => {
    const s = useTestStore.getState()
    const text = generatePrompt(s.promptType as PromptMode, s.duration, s.customPromptText)
    s.setPrompt(splitPrompt(text))
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

  // ── Test actions ──────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (store.prompt.length === 0) loadPrompt()

    if (store.mode === 'speed') {
      scoringFrozenRef.current = true
      firstSpeechTsRef.current = null
      firstSpeechFiredRef.current = false
      prevConfirmedLenRef.current = 0
      prevEnrichedLenRef.current = 0
      pendingConfirmedWordsRef.current = []
      optimisticCountRef.current = 0
      optimisticBaseIndexRef.current = 0
      startTimeRef.current = null
      clearSpeedArmingTimers()
      resetProvider()

      // ── Warm-connect: arm Deepgram WS+mic immediately so the 2–1 countdown
      //    absorbs the TLS + WS handshake latency (no-op for WebSpeech).
      //    We await armSession so the WS is open before startSession() runs;
      //    startSession() then detects the armed state and returns instantly.
      if (armSession) {
        const armed = await armSession()
        if (!armed) {
          scoringFrozenRef.current = false
          setArmingCountdown(null)
          armingEndTsRef.current = null
          return
        }
      }

      const didStart = await startSession()
      if (!didStart) {
        scoringFrozenRef.current = false
        setArmingCountdown(null)
        armingEndTsRef.current = null
        return
      }

      store.startTest()

      if (SPEED_ARMING_MS > 0) {
        armingEndTsRef.current = Date.now() + SPEED_ARMING_MS
        setArmingCountdown(2)
        armTimerIdsRef.current.push(window.setTimeout(() => setArmingCountdown(1), 1000))
        armTimerIdsRef.current.push(
          window.setTimeout(() => {
            setArmingCountdown(null)
            tryCommitSpeedEpoch()
          }, SPEED_ARMING_MS)
        )
      } else {
        armingEndTsRef.current = null
        setArmingCountdown(null)
      }
    } else {
      store.startTest()
      startTimeRef.current = useTestStore.getState().testStartedAt
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.mode, store.prompt.length, loadPrompt, armSession, startSession, tryCommitSpeedEpoch, clearSpeedArmingTimers, resetProvider])

  const handleStop = useCallback(() => {
    const s = useTestStore.getState()
    if (s.mode === 'speed') {
      clearSpeedArmingTimers()
      setArmingCountdown(null)
      armingEndTsRef.current = null
      firstSpeechTsRef.current = null
      scoringFrozenRef.current = false
      stopTimer()
      stopSession()
      flushSpeedWpmSnapshot()
      s.finaliseConsistency()
      const pbKey = `speed-${s.duration}s-${s.promptType}`
      const newBest = s.checkAndUpdatePersonalBest(pbKey, s.wpm)
      setIsPersonalBest(newBest)
    } else {
      const promptStr = s.prompt.join(' ')
      const diff = diffWords(promptStr, s.clarityTranscript)
      const promptWordCount = promptStr.trim().split(/\s+/).filter(Boolean).length
      const { score, grade } = calcClarityScore(diff, promptWordCount)
      s.setDiffResult(diff, score, grade)
    }
    useTestStore.getState().setTestState('ended')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flushSpeedWpmSnapshot, clearSpeedArmingTimers, stopTimer, stopSession])

  useEffect(() => {
    handleStopRef.current = handleStop
  }, [handleStop])

  useEffect(() => {
    if (store.testState !== 'running' || store.mode !== 'speed') return
    const id = window.setTimeout(() => {
      const s = useTestStore.getState()
      if (s.testState === 'running' && s.mode === 'speed' && s.speedClockStartedAt == null) {
        handleStopRef.current()
      }
    }, SPEED_NO_SPEECH_WATCHDOG_MS)
    return () => clearTimeout(id)
  }, [store.testState, store.mode])

  const handleRetry = useCallback(() => {
    setIsPersonalBest(false)
    const s = useTestStore.getState()
    const last = s.prompt.join(' ')
    clearSpeedArmingTimers()
    setArmingCountdown(null)
    startTimeRef.current = null
    armingEndTsRef.current = null
    firstSpeechTsRef.current = null
    firstSpeechFiredRef.current = false
    prevConfirmedLenRef.current = 0
    prevEnrichedLenRef.current = 0
    pendingConfirmedWordsRef.current = []
    optimisticCountRef.current = 0
    optimisticBaseIndexRef.current = 0
    scoringFrozenRef.current = false
    resetProvider()
    s.resetTest()
    resetTimer(s.duration)
    const s2 = useTestStore.getState()
    const text = regeneratePrompt(s2.promptType as PromptMode, s2.duration, last, s2.customPromptText)
    s2.setPrompt(splitPrompt(text))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSpeedArmingTimers, resetProvider])

  const handlePractice = useCallback(() => {
    setIsPersonalBest(false)
    const s = useTestStore.getState()
    const missedWords = s.confirmedWords
      .filter((w) => !w.isCorrect)
      .map((w) => w.word)
    clearSpeedArmingTimers()
    setArmingCountdown(null)
    startTimeRef.current = null
    armingEndTsRef.current = null
    firstSpeechTsRef.current = null
    firstSpeechFiredRef.current = false
    prevConfirmedLenRef.current = 0
    prevEnrichedLenRef.current = 0
    pendingConfirmedWordsRef.current = []
    optimisticCountRef.current = 0
    optimisticBaseIndexRef.current = 0
    scoringFrozenRef.current = false
    resetProvider()
    s.resetTest()
    resetTimer(s.duration)
    const practiceText = generatePracticePrompt(missedWords, s.duration)
    useTestStore.getState().setPrompt(splitPrompt(practiceText))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSpeedArmingTimers, resetProvider])

  const handleNext = useCallback(() => {
    setIsPersonalBest(false)
    const s = useTestStore.getState()
    const last = s.prompt.join(' ')
    clearSpeedArmingTimers()
    setArmingCountdown(null)
    startTimeRef.current = null
    armingEndTsRef.current = null
    firstSpeechTsRef.current = null
    firstSpeechFiredRef.current = false
    prevConfirmedLenRef.current = 0
    prevEnrichedLenRef.current = 0
    pendingConfirmedWordsRef.current = []
    optimisticCountRef.current = 0
    optimisticBaseIndexRef.current = 0
    scoringFrozenRef.current = false
    resetProvider()
    s.resetTest()
    resetTimer(s.duration)
    const s2 = useTestStore.getState()
    const text = regeneratePrompt(s2.promptType as PromptMode, s2.duration, last, s2.customPromptText)
    s2.setPrompt(splitPrompt(text))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSpeedArmingTimers, resetProvider])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return

      if (e.key === 'Tab') {
        e.preventDefault()
        if (store.testState === 'running') handleStop()
        else if (store.testState === 'ended') handleRetry()
        else {
          clearSpeedArmingTimers()
          setArmingCountdown(null)
          startTimeRef.current = null
          armingEndTsRef.current = null
          firstSpeechTsRef.current = null
          firstSpeechFiredRef.current = false
          prevConfirmedLenRef.current = 0
          prevEnrichedLenRef.current = 0
          pendingConfirmedWordsRef.current = []
          optimisticCountRef.current = 0
          optimisticBaseIndexRef.current = 0
          scoringFrozenRef.current = false
          resetProvider()
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
      if (e.ctrlKey && e.key === '1') { e.preventDefault(); store.setMode('speed') }
      if (e.ctrlKey && e.key === '2') { e.preventDefault(); store.setMode('clarity') }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.testState, store.duration, handleRetry, handleNext, handleStop, handleStart, clearSpeedArmingTimers, resetTimer, resetProvider])

  // ── Render ────────────────────────────────────────────────────────────────
  // isRunning is declared above (needed for useSpeculativeMatch)
  const isEnded   = store.testState === 'ended'
  const isIdle    = store.testState === 'idle'

  const testExit = { opacity: 0, y: -16 }
  const testExitTransition = { duration: 0.22, ease: 'easeIn' as const }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <Header onSettingsOpen={() => setSettingsOpen(true)} />

      <AnimatePresence>{isIdle && <ConfigBar key="config-bar" />}</AnimatePresence>

      <AnimatePresence>
        {isRunning && (
          <StatsBar
            key="stats-bar"
            mode={store.mode}
            wpm={store.wpm}
            rawWpm={store.rawWpm}
            wordCount={
              store.mode === 'clarity'
                ? store.clarityTranscript.trim().split(/\s+/).filter(Boolean).length
                : store.confirmedWords.length
            }
            fillerCount={store.fillerCount}
            timeRemainingMs={timeRemaining}
            isWarning={isWarning}
            micState={store.micState}
          />
        )}
      </AnimatePresence>

      <main
        className={`flex-1 flex flex-col items-center px-6 py-8 mx-auto w-full justify-center ${
          store.mode === 'speed' ? 'max-w-[1400px]' : 'max-w-3xl'
        } ${store.mode === 'speed' && !isEnded ? 'pb-[88px]' : ''}`}
      >
        <AnimatePresence mode="wait">
          {!isEnded ? (
            <motion.div
              key="test"
              className="relative w-full flex flex-col items-stretch"
              initial={false}
              exit={testExit}
              transition={testExitTransition}
            >
              <div className="relative w-full flex flex-col">
                {/* Arming countdown overlay */}
                {store.mode === 'speed' && isRunning && armingCountdown != null ? (
                  <div
                    className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
                    style={{ background: 'color-mix(in srgb, var(--bg) 55%, transparent)' }}
                    aria-live="polite"
                    aria-label="Countdown to start"
                  >
                    <span
                      className="font-mono font-bold tabular-nums"
                      style={{ fontSize: 'clamp(4rem, 18vw, 7rem)', color: 'var(--accent)', lineHeight: 1 }}
                    >
                      {armingCountdown}
                    </span>
                  </div>
                ) : null}

                {store.mode === 'speed' && (
                  <FillerFlash trigger={store.fillerFlashTrigger} isWarning={store.fillerWarning} />
                )}

                {store.mode === 'speed' ? (
                  <div className="flex flex-col w-full gap-10">
                    <TestArea
                      words={store.prompt}
                      confirmedWords={store.confirmedWords}
                      currentWordIndex={store.currentWordIndex}
                      liveTranscript={interimText}
                      isIdle={isIdle}
                      testActive={isRunning}
                      blindMode={store.settings.blindMode}
                    />
                    {isIdle && <MicButton onStart={handleStart} micState={store.micState} />}
                  </div>
                ) : (
                  <ClarityInput
                    testState={store.testState}
                    transcript={store.clarityTranscript}
                    diffResult={store.diffResult}
                    prompt={store.prompt}
                    onChange={(val) => store.setClarityTranscript(val)}
                    onStop={handleStop}
                    onStart={handleStart}
                  />
                )}
              </div>

              {store.mode === 'speed' && (
                <>
                  <WaveformVisualiser
                    stream={micStream}
                    isActive={store.testState === 'running'}
                    hasError={waveformErrorFlash}
                  />

                  {/* Step 7 — Provider status indicator */}
                  {isRunning && (
                    <div
                      style={{
                        position: 'fixed',
                        bottom: '1rem',
                        right: '1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.65rem',
                        color: '#44445a',
                        fontFamily: 'var(--font-mono), ui-monospace, monospace',
                        letterSpacing: '0.04em',
                        pointerEvents: 'none',
                        userSelect: 'none',
                      }}
                      aria-label={`Active STT provider: ${sttProvider}`}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: isListening ? '#4ade80' : '#555566',
                          display: 'inline-block',
                          flexShrink: 0,
                        }}
                      />
                      {sttProvider === 'deepgram' ? 'deepgram' : 'browser'}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          ) : (
            <ResultsPanel
              key="results"
              mode={store.mode}
              wpm={store.wpm}
              rawWpm={store.rawWpm}
              wordCount={store.confirmedWords.length}
              fillerCount={store.fillerCount}
              peakWpm={store.peakWpm}
              consistency={store.consistency}
              duration={store.duration}
              promptType={store.promptType}
              prompt={store.prompt}
              confirmedWords={store.confirmedWords}
              wpmSnapshots={store.wpmSnapshots}
              testStartedAt={store.testStartedAt}
              speedClockStartedAt={store.speedClockStartedAt}
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
        </AnimatePresence>
      </main>

      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
