'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { AnimatePresence } from 'framer-motion'

import { useTestStore }  from '@/store/testStore'
import { useTimer }      from '@/hooks/useTimer'
import { useDeepgram }   from '@/hooks/useDeepgram'
import { useDiff }       from '@/hooks/useDiff'
import { getPrompt }     from '@/lib/prompts'

import Header        from '@/components/Header'
import ConfigBar     from '@/components/ConfigBar'
import StatsBar      from '@/components/StatsBar'
import TestArea      from '@/components/TestArea'
import FillerFlash   from '@/components/FillerFlash'
import MicButton     from '@/components/MicButton'
import ClarityInput  from '@/components/ClarityInput'
import ResultsPanel  from '@/components/ResultsPanel'
import SettingsPanel from '@/components/SettingsPanel'
import WaveformVisualiser from '@/components/WaveformVisualiser'

export default function Home() {
  const store = useTestStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const startTimeRef = useRef<number | null>(null)

  // ── Restore persisted settings to DOM on mount ──────────────────────────────
  useEffect(() => {
    const { settings } = store
    const html = document.documentElement
    // Apply theme palette + accent
    import('@/lib/themes').then(({ THEMES, applyTheme }) => {
      const theme = THEMES[settings.theme] ?? THEMES.mocha
      applyTheme(theme, settings.accentHex)
    })
    html.dataset.font     = settings.font
    html.dataset.fontsize = settings.fontSize
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Timer ───────────────────────────────────────────────────────────────────
  const handleTimerEnd = useCallback(() => {
    store.finaliseConsistency()
    store.setTestState('ended')
    stopStream()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { timeRemaining, isWarning, start: startTimer, stop: stopTimer, reset: resetTimer } =
    useTimer(store.duration, handleTimerEnd)

  // ── WPM tracking ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (store.testState !== 'running' || store.mode !== 'speed') return
    if (!startTimeRef.current) return

    const elapsedMs = Date.now() - startTimeRef.current
    if (elapsedMs < 3000) return

    const netWords = Math.max(0, store.confirmedWords.length - store.fillerCount)
    const elapsedMin = elapsedMs / 60_000
    const computed = Math.round(netWords / elapsedMin)
    store.setWpm(computed)
    if (computed > store.peakWpm) store.setPeakWpm(computed)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.confirmedWords.length])

  // ── WPM interval ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (store.testState !== 'running' || store.mode !== 'speed') return
    const id = setInterval(() => {
      if (!startTimeRef.current) return
      const elapsedMs = Date.now() - startTimeRef.current
      if (elapsedMs < 3000) return
      const netWords = Math.max(0, store.confirmedWords.length - store.fillerCount)
      const computed = Math.round(netWords / (elapsedMs / 60_000))
      store.setWpm(computed)
      if (computed > store.peakWpm) store.setPeakWpm(computed)
      // Snapshot every 5 seconds
      store.addWpmSnapshot({ wpm: computed, timestamp: Date.now() })
    }, 500)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.testState, store.mode])

  // ── Deepgram ─────────────────────────────────────────────────────────────────
  const handleWord = useCallback((result: import('@/store/testStore').WordResult) => {
    store.addWord(result)
    store.advanceWord()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFiller = useCallback(() => {
    store.detectFiller()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { micState, micStream, liveTranscript, startStream, stopStream } = useDeepgram(handleWord, handleFiller)

  // Sync micState to store
  useEffect(() => {
    store.setMicState(micState)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micState])

  // ── Diff (Clarity Mode) ──────────────────────────────────────────────────────
  const { run: runDiff } = useDiff()

  // ── Prompt management ────────────────────────────────────────────────────────
  const { promptType, duration, customPromptText, setPrompt } = store
  const loadPrompt = useCallback(() => {
    const words = getPrompt(promptType, duration, customPromptText)
    setPrompt(words)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptType, duration, customPromptText])

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
      startTimeRef.current = Date.now()
      startTimer()
    } else {
      store.startTest()
      startTimeRef.current = Date.now()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.mode, store.prompt.length, loadPrompt])

  const handleStop = useCallback(() => {
    if (store.mode === 'speed') {
      stopTimer()
      stopStream()
      store.finaliseConsistency()
    } else {
      // Clarity mode — run diff
      runDiff(store.prompt.join(' '), store.clarityTranscript)
    }
    store.setTestState('ended')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.mode, store.prompt, store.clarityTranscript])

  const handleRetry = useCallback(() => {
    store.resetTest()
    resetTimer(store.duration)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.duration])

  const handleNext = useCallback(() => {
    store.resetTest()
    resetTimer(store.duration)
    loadPrompt()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.duration])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName

      // Don't intercept when typing in textarea/input
      if (tag === 'TEXTAREA' || tag === 'INPUT') return

      if (e.key === 'Tab') {
        e.preventDefault()
        if (store.testState === 'running') handleStop()
        else { store.resetTest(); resetTimer(store.duration) }
      }

      if (e.key === 'Enter' && store.testState === 'idle') {
        e.preventDefault()
        handleStart()
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
  }, [store.testState, store.duration])

  // ── Clarity mode stop handler ─────────────────────────────────────────────────
  const handleClarityStop = useCallback(() => {
    runDiff(store.prompt.join(' '), store.clarityTranscript)
    store.setDiffResult([], store.clarityScore, store.clarityGrade)
    store.setTestState('ended')
  }, [store, runDiff])

  // ── Render ────────────────────────────────────────────────────────────────────
  const isRunning = store.testState === 'running'
  const isEnded   = store.testState === 'ended'
  const isIdle    = store.testState === 'idle'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <Header onSettingsOpen={() => setSettingsOpen(true)} />

      {/* Config bar — visible when idle */}
      <AnimatePresence>
        {isIdle && <ConfigBar key="config-bar" />}
      </AnimatePresence>

      {/* Stats bar — visible when running */}
      <AnimatePresence>
        {isRunning && (
          <StatsBar
            key="stats-bar"
            mode={store.mode}
            wpm={store.wpm}
            wordCount={store.confirmedWords.length}
            fillerCount={store.fillerCount}
            timeRemainingMs={timeRemaining}
            isWarning={isWarning}
            micState={store.micState}
          />
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-3xl mx-auto w-full">

        {/* Test area wrapper — relative for FillerFlash overlay */}
        <div
          className="relative w-full rounded-lg p-6 mb-4"
          style={{ minHeight: '12rem' }}
        >
          {/* Filler flash overlay (Speed mode only) */}
          {store.mode === 'speed' && (
            <FillerFlash
              trigger={store.fillerFlashTrigger}
              isWarning={store.fillerWarning}
            />
          )}

          {/* Content */}
          {store.mode === 'speed' ? (
            <TestArea
              words={store.prompt}
              confirmedWords={store.confirmedWords}
              currentWordIndex={store.currentWordIndex}
              liveTranscript={liveTranscript}
            />
          ) : (
            <ClarityInput
              testState={store.testState}
              transcript={store.clarityTranscript}
              diffResult={store.diffResult}
              prompt={store.prompt}
              onChange={(val) => store.setClarityTranscript(val)}
              onStop={handleClarityStop}
              onStart={handleStart}
            />
          )}
        </div>

        {/* Mic button — Speed mode, idle state */}
        {store.mode === 'speed' && isIdle && (
          <MicButton onStart={handleStart} micState={store.micState} />
        )}

        {/* Results panel */}
        <AnimatePresence>
          {isEnded && (
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
              clarityScore={store.clarityScore}
              clarityGrade={store.clarityGrade}
              diffResult={store.diffResult}
              onRetry={handleRetry}
              onNext={handleNext}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Settings panel */}
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Live microphone waveform */}
      <AnimatePresence>
        {store.mode === 'speed' && isRunning && (
          <WaveformVisualiser
            key="waveform"
            stream={micStream}
            isActive={store.micState === 'active'}
            hasError={store.micState === 'denied' || store.micState === 'error'}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
