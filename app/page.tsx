'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { useTestStore } from '@/store/testStore'
import { useTimer } from '@/hooks/useTimer'
import { useDeepgram } from '@/hooks/useDeepgram'
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

export default function Home() {
  const store = useTestStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [waveformErrorFlash, setWaveformErrorFlash] = useState(false)
  const startTimeRef = useRef<number | null>(null)
  const errorFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevFillerTriggerRef = useRef<number | null>(null)

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
    flushSpeedWpmSnapshot()
    store.finaliseConsistency()
    store.setTestState('ended')
    stopStream()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flushSpeedWpmSnapshot])

  const { timeRemaining, isWarning, start: startTimer, stop: stopTimer, reset: resetTimer } =
    useTimer(store.duration, handleTimerEnd)

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

  // ── Deepgram: one `is_final` may contain many tokens — align batch to prompt (see lib/asrPromptAlign)
  const handleFinalWords = useCallback(
    (tokens: string[]) => {
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

  const { micState, micStream, liveTranscript, startStream, stopStream } = useDeepgram(handleFinalWords)

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
      const didStart = await startStream()
      if (!didStart) return
      store.startTest()
      startTimeRef.current = useTestStore.getState().testStartedAt
      startTimer()
    } else {
      store.startTest()
      startTimeRef.current = useTestStore.getState().testStartedAt
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.mode, store.prompt.length, loadPrompt])

  const handleStop = useCallback(() => {
    const s = useTestStore.getState()
    if (s.mode === 'speed') {
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
  }, [flushSpeedWpmSnapshot])

  const handleRetry = useCallback(() => {
    const s = useTestStore.getState()
    const last = s.prompt.join(' ')
    s.resetTest()
    resetTimer(s.duration)
    const s2 = useTestStore.getState()
    const text = regeneratePrompt(s2.promptType as PromptMode, s2.duration, last, s2.customPromptText)
    s2.setPrompt(splitPrompt(text))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleNext = useCallback(() => {
    const s = useTestStore.getState()
    const last = s.prompt.join(' ')
    s.resetTest()
    resetTimer(s.duration)
    const s2 = useTestStore.getState()
    const text = regeneratePrompt(s2.promptType as PromptMode, s2.duration, last, s2.customPromptText)
    s2.setPrompt(splitPrompt(text))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  }, [store.testState, store.duration, handleRetry, handleNext, handleStop, handleStart])

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
