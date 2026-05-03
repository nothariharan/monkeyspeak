'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { useTestStore } from '@/store/testStore'
import { useTimer } from '@/hooks/useTimer'
import { useWebSpeech } from '@/hooks/useWebSpeech'
import { generatePrompt, regeneratePrompt, type PromptMode } from '@/lib/prompts'
import { diffWords, calcClarityScore } from '@/lib/diff'

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
import { alignAsrFinalToPrompt } from '@/lib/asrPromptAlign'

function splitPrompt(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

/** 3–2–1 arming: recognition runs but scoring/timer wait until max(armEnd, firstSpeech). Set 0 to disable UI and arm window. */
const SPEED_ARMING_MS = 3000
const SPEED_NO_SPEECH_WATCHDOG_MS = 25_000

export default function Home() {
  const store = useTestStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [waveformErrorFlash, setWaveformErrorFlash] = useState(false)
  const startTimeRef = useRef<number | null>(null)
  const errorFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevFillerTriggerRef = useRef<number | null>(null)
  const scoringFrozenRef = useRef(false)
  const firstSpeechTsRef = useRef<number | null>(null)
  const armingEndTsRef = useRef<number | null>(null)
  /** Timer handles (DOM number vs Node Timeout — widen for tsc). */
  const armTimerIdsRef = useRef<Array<number | ReturnType<typeof setTimeout>>>([])
  const resetInterimEmittedRef = useRef<() => void>(() => {})
  const handleStopRef = useRef<() => void>(() => {})
  const stopStreamRef = useRef<() => void>(() => {})
  const [armingCountdown, setArmingCountdown] = useState<number | null>(null)

  const clearSpeedArmingTimers = useCallback(() => {
    for (const id of armTimerIdsRef.current) {
      clearTimeout(id)
    }
    armTimerIdsRef.current = []
  }, [])

  /** Latest word counts + WPM from Zustand (avoids stale closures in intervals). */
  const flushSpeedWpmSnapshot = useCallback(() => {
    const t0 = startTimeRef.current
    if (t0 == null) return
    const s = useTestStore.getState()
    if (s.mode !== 'speed') return
    const elapsedMs = Date.now() - t0
    if (elapsedMs < 3000) return
    const netWords = Math.max(0, s.confirmedWords.length - s.fillerCount)
    const elapsedMin = elapsedMs / 60_000
    const computed = Math.round(netWords / elapsedMin)
    s.setWpm(computed)
    if (computed > s.peakWpm) s.setPeakWpm(computed)
    s.addWpmSnapshot({ wpm: computed, timestamp: Date.now() })
  }, [])

  const triggerWaveformError = useCallback(() => {
    if (errorFlashTimeoutRef.current !== null) {
      clearTimeout(errorFlashTimeoutRef.current)
    }
    setWaveformErrorFlash(true)
    errorFlashTimeoutRef.current = setTimeout(() => {
      setWaveformErrorFlash(false)
      errorFlashTimeoutRef.current = null
    }, 600)
  }, [])

  useEffect(
    () => () => {
      if (errorFlashTimeoutRef.current !== null) {
        clearTimeout(errorFlashTimeoutRef.current)
      }
    },
    []
  )

  // ── Restore persisted settings to DOM on mount ──────────────────────────────
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

  // ── Timer ───────────────────────────────────────────────────────────────────
  const handleTimerEnd = useCallback(() => {
    clearSpeedArmingTimers()
    setArmingCountdown(null)
    armingEndTsRef.current = null
    firstSpeechTsRef.current = null
    scoringFrozenRef.current = false
    flushSpeedWpmSnapshot()
    store.finaliseConsistency()
    store.setTestState('ended')
    stopStreamRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flushSpeedWpmSnapshot, clearSpeedArmingTimers])

  const { timeRemaining, isWarning, start: startTimer, stop: stopTimer, reset: resetTimer } =
    useTimer(store.duration, handleTimerEnd)

  const tryCommitSpeedEpoch = useCallback(() => {
    const s = useTestStore.getState()
    if (s.testState !== 'running' || s.mode !== 'speed') return
    if (s.speedClockStartedAt != null) return
    if (firstSpeechTsRef.current == null) return
    const armEnd = armingEndTsRef.current
    if (armEnd != null && Date.now() < armEnd) return
    const epoch =
      armEnd != null
        ? Math.max(armEnd, firstSpeechTsRef.current)
        : firstSpeechTsRef.current
    useTestStore.getState().setSpeedClockStartedAt(epoch)
    startTimeRef.current = epoch
    scoringFrozenRef.current = false
    resetInterimEmittedRef.current()
    startTimer()
  }, [startTimer])

  const onFirstRecognitionActivity = useCallback(() => {
    const s = useTestStore.getState()
    if (s.testState !== 'running' || s.mode !== 'speed') return
    if (firstSpeechTsRef.current != null) return
    firstSpeechTsRef.current = Date.now()
    tryCommitSpeedEpoch()
  }, [tryCommitSpeedEpoch])

  // ── WPM tracking ────────────────────────────────────────────────────────────
  useEffect(() => {
    const s = useTestStore.getState()
    if (s.testState !== 'running' || s.mode !== 'speed') return
    if (!startTimeRef.current) return

    const elapsedMs = Date.now() - startTimeRef.current
    if (elapsedMs < 3000) return

    const netWords = Math.max(0, s.confirmedWords.length - s.fillerCount)
    const elapsedMin = elapsedMs / 60_000
    const computed = Math.round(netWords / elapsedMin)
    s.setWpm(computed)
    if (computed > s.peakWpm) s.setPeakWpm(computed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.confirmedWords.length])

  // ── WPM interval ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (store.testState !== 'running' || store.mode !== 'speed') return
    const id = setInterval(() => {
      if (!startTimeRef.current) return
      const s = useTestStore.getState()
      if (s.testState !== 'running' || s.mode !== 'speed') return
      const elapsedMs = Date.now() - startTimeRef.current
      if (elapsedMs < 3000) return
      const netWords = Math.max(0, s.confirmedWords.length - s.fillerCount)
      const computed = Math.round(netWords / (elapsedMs / 60_000))
      s.setWpm(computed)
      if (computed > s.peakWpm) s.setPeakWpm(computed)
      s.addWpmSnapshot({ wpm: computed, timestamp: Date.now() })
    }, 500)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.testState, store.mode])

  // ── ASR finals / stable interim → prompt (see lib/asrPromptAlign)
  const handleFinalWords = useCallback(
    (tokens: string[]) => {
      if (useTestStore.getState().speedClockStartedAt == null) return
      const { prompt, currentWordIndex, addWord, advanceWord, detectFiller } = useTestStore.getState()
      const batch = alignAsrFinalToPrompt(tokens, prompt, currentWordIndex, () => {
        detectFiller()
      })
      for (const result of batch) {
        if (!result.isCorrect) {
          triggerWaveformError()
        }
        addWord(result)
        advanceWord()
      }
    },
    [triggerWaveformError]
  )

  const { micState, micStream, liveTranscript, startStream, stopStream, resetInterimEmitted } =
    useWebSpeech(handleFinalWords, {
      scoringFrozenRef,
      onFirstRecognitionActivity,
    })

  useEffect(() => {
    resetInterimEmittedRef.current = resetInterimEmitted
    stopStreamRef.current = stopStream
  }, [resetInterimEmitted, stopStream])

  useEffect(() => {
    const t = store.fillerFlashTrigger
    if (prevFillerTriggerRef.current !== null && t > prevFillerTriggerRef.current) {
      triggerWaveformError()
    }
    prevFillerTriggerRef.current = t
  }, [store.fillerFlashTrigger, triggerWaveformError])

  // Sync micState to store
  useEffect(() => {
    store.setMicState(micState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micState])

  // ── Prompt management ────────────────────────────────────────────────────────
  const loadPrompt = useCallback(() => {
    const s = useTestStore.getState()
    const text = generatePrompt(s.promptType as PromptMode, s.duration, s.customPromptText)
    s.setPrompt(splitPrompt(text))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load initial prompt and reload on config changes
  useEffect(() => {
    if (store.testState === 'idle') loadPrompt()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.promptType, store.duration, store.mode])

  // Ensure prompt on first mount
  useEffect(() => {
    if (store.prompt.length === 0) loadPrompt()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Test actions ─────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (store.prompt.length === 0) loadPrompt()

    if (store.mode === 'speed') {
      scoringFrozenRef.current = true
      firstSpeechTsRef.current = null
      startTimeRef.current = null
      clearSpeedArmingTimers()

      const didStart = await startStream()
      if (!didStart) {
        scoringFrozenRef.current = false
        setArmingCountdown(null)
        armingEndTsRef.current = null
        return
      }

      store.startTest()

      if (SPEED_ARMING_MS > 0) {
        armingEndTsRef.current = Date.now() + SPEED_ARMING_MS
        setArmingCountdown(3)
        armTimerIdsRef.current.push(window.setTimeout(() => setArmingCountdown(2), 1000))
        armTimerIdsRef.current.push(window.setTimeout(() => setArmingCountdown(1), 2000))
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
  }, [store.mode, store.prompt.length, loadPrompt, startStream, tryCommitSpeedEpoch, clearSpeedArmingTimers])

  const handleStop = useCallback(() => {
    const s = useTestStore.getState()
    if (s.mode === 'speed') {
      clearSpeedArmingTimers()
      setArmingCountdown(null)
      armingEndTsRef.current = null
      firstSpeechTsRef.current = null
      scoringFrozenRef.current = false
      stopTimer()
      stopStream()
      flushSpeedWpmSnapshot()
      s.finaliseConsistency()
    } else {
      const promptStr = s.prompt.join(' ')
      const diff = diffWords(promptStr, s.clarityTranscript)
      const promptWordCount = promptStr.trim().split(/\s+/).filter(Boolean).length
      const { score, grade } = calcClarityScore(diff, promptWordCount)
      s.setDiffResult(diff, score, grade)
    }
    useTestStore.getState().setTestState('ended')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flushSpeedWpmSnapshot, clearSpeedArmingTimers, stopTimer, stopStream])

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
    const s = useTestStore.getState()
    const last = s.prompt.join(' ')
    clearSpeedArmingTimers()
    setArmingCountdown(null)
    startTimeRef.current = null
    armingEndTsRef.current = null
    firstSpeechTsRef.current = null
    scoringFrozenRef.current = false
    s.resetTest()
    resetTimer(s.duration)
    const s2 = useTestStore.getState()
    const text = regeneratePrompt(s2.promptType as PromptMode, s2.duration, last, s2.customPromptText)
    s2.setPrompt(splitPrompt(text))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSpeedArmingTimers])

  const handleNext = useCallback(() => {
    const s = useTestStore.getState()
    const last = s.prompt.join(' ')
    clearSpeedArmingTimers()
    setArmingCountdown(null)
    startTimeRef.current = null
    armingEndTsRef.current = null
    firstSpeechTsRef.current = null
    scoringFrozenRef.current = false
    s.resetTest()
    resetTimer(s.duration)
    const s2 = useTestStore.getState()
    const text = regeneratePrompt(s2.promptType as PromptMode, s2.duration, last, s2.customPromptText)
    s2.setPrompt(splitPrompt(text))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSpeedArmingTimers])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
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
          scoringFrozenRef.current = false
          store.resetTest()
          resetTimer(store.duration)
        }
      }

      if (e.key === 'Enter') {
        if (store.testState === 'ended') {
          e.preventDefault()
          handleNext()
        } else if (store.testState === 'idle') {
          e.preventDefault()
          handleStart()
        }
      }

      if (e.key === 'Escape' && store.testState === 'running') {
        e.preventDefault()
        handleStop()
      }

      if (e.ctrlKey && e.key === ',') {
        e.preventDefault()
        setSettingsOpen((o) => !o)
      }

      if (e.ctrlKey && e.key === '1') {
        e.preventDefault()
        store.setMode('speed')
      }

      if (e.ctrlKey && e.key === '2') {
        e.preventDefault()
        store.setMode('clarity')
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.testState, store.duration, handleRetry, handleNext, handleStop, handleStart, clearSpeedArmingTimers, resetTimer])

  // ── Render ────────────────────────────────────────────────────────────────────
  const isRunning = store.testState === 'running'
  const isEnded = store.testState === 'ended'
  const isIdle = store.testState === 'idle'

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
        className={`flex-1 flex flex-col items-center px-6 py-8 mx-auto w-full justify-center max-w-3xl ${
          store.mode === 'speed' && !isEnded ? 'pb-[88px]' : ''
        }`}
      >
        <AnimatePresence mode="wait">
          {!isEnded ? (
            <motion.div
              key="test"
              className="relative w-full flex flex-col items-center"
              initial={false}
              exit={testExit}
              transition={testExitTransition}
            >
              <div
                className="relative w-full rounded-lg p-6 mb-4 flex flex-col items-center justify-center"
                style={{
                  minHeight:
                    store.mode === 'clarity' ? 'auto' : isIdle ? '8rem' : '12rem',
                }}
              >
                {store.mode === 'speed' && isRunning && armingCountdown != null ? (
                  <div
                    className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg"
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
                  <div className="flex flex-col items-center gap-12">
                    <TestArea
                      words={store.prompt}
                      confirmedWords={store.confirmedWords}
                      currentWordIndex={store.currentWordIndex}
                      liveTranscript={liveTranscript}
                      isIdle={isIdle}
                      testActive={isRunning}
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
                <WaveformVisualiser
                  stream={micStream}
                  isActive={store.testState === 'running'}
                  hasError={waveformErrorFlash}
                />
              )}
            </motion.div>
          ) : (
            <ResultsPanel
              key="results"
              mode={store.mode}
              wpm={store.wpm}
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
              onRetry={handleRetry}
              onNext={handleNext}
            />
          )}
        </AnimatePresence>
      </main>

      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
