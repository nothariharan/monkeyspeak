'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { useTestStore } from '@/store/testStore'
import { useTimer } from '@/hooks/useTimer'
import { useActiveSpeechProvider } from '@/hooks/useActiveSpeechProvider'
import { generatePrompt, regeneratePrompt, generatePracticePrompt, type PromptMode } from '@/lib/prompts'
import { diffWords, calcClarityScore } from '@/lib/diff'
import { alignTranscriptToPrompt, countFillers } from '@/lib/alignTranscriptToPrompt'
import { netWpmFromChars, rawWpmFromChars } from '@/lib/stats/wpm'

import Header from '@/components/Header'
import ConfigBar from '@/components/ConfigBar'
import StatsBar from '@/components/StatsBar'
import TestArea from '@/components/TestArea'
import MicButton from '@/components/MicButton'
import ClarityInput from '@/components/ClarityInput'
import ResultsPanel from '@/components/ResultsPanel'
import SettingsPanel from '@/components/SettingsPanel'
import WaveformVisualiser from '@/components/WaveformVisualiser'

function splitPrompt(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

export default function Home() {
  const store = useTestStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isPersonalBest, setIsPersonalBest] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [dissolvedCount, setDissolvedCount] = useState(0)

  const testStartedAtRef = useRef<number | null>(null)

  // Mirror STT state into refs so the finalize callback can read fresh values
  // without needing them as effect dependencies.
  const confirmedWordsRef = useRef<string[]>([])
  const interimTextRef = useRef('')

  const sttProvider = store.settings.sttProvider ?? 'webspeech'
  const {
    interimText,
    confirmedWords,
    fillerCount: sttFillerCount,
    isListening,
    error: sttError,
    micStream,
    armSession,
    startSession,
    stopSession,
    reset: resetProvider,
    onSpeechStart,
  } = useActiveSpeechProvider(sttProvider)

  // Keep refs in sync with STT state
  useEffect(() => { confirmedWordsRef.current = confirmedWords }, [confirmedWords])
  useEffect(() => { interimTextRef.current = interimText }, [interimText])

  // ── STT-driven dissolve ───────────────────────────────────────────────────
  // Words dissolve as the STT engine hears them. Interim results update almost
  // instantly, so fold them in alongside confirmed words; keep the count
  // monotonic so a shrinking interim never "un-dissolves" a word.
  useEffect(() => {
    if (store.testState !== 'running' || store.mode !== 'speed') return
    const interim = interimText.trim()
    const interimWords = interim ? interim.split(/\s+/).length : 0
    const liveCount = confirmedWords.length + interimWords
    setDissolvedCount((c) => Math.min(Math.max(c, liveCount), store.prompt.length))
  }, [confirmedWords.length, interimText, store.testState, store.mode, store.prompt.length])

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

  // ── Finalize speed test ───────────────────────────────────────────────────
  const finalizeSpeed = useCallback((elapsedSec: number) => {
    stopSession()

    const s = useTestStore.getState()
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

    const pbKey = `speed-${s.duration}s-${s.promptType}`
    const newBest = s.checkAndUpdatePersonalBest(pbKey, netWpm)
    setIsPersonalBest(newBest)

    // Delta vs the previous run, then remember this run for next time.
    const prevWpm = s.settings.lastSpeedWpm
    const deltaWpm = typeof prevWpm === 'number' ? netWpm - prevWpm : null
    s.updateSettings({ lastSpeedWpm: netWpm })

    s.setResults({ netWpm, rawWpm, fillerCount, accuracy, diff, elapsedSec, transcript: fullTranscript, deltaWpm })
    s.setTestState('ended')
  }, [stopSession])

  // ── Timer ─────────────────────────────────────────────────────────────────
  const handleTimerEnd = useCallback(() => {
    finalizeSpeed(store.duration)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalizeSpeed, store.duration])

  const { timeRemaining, isWarning, start: startTimer, stop: stopTimer, reset: resetTimer } =
    useTimer(store.duration, handleTimerEnd)

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
    setStartError(null)
    if (store.prompt.length === 0) loadPrompt()

    const s = useTestStore.getState()

    if (store.mode === 'speed') {
      resetProvider()

      if (armSession) {
        const armed = await armSession()
        if (!armed.ok) {
          setStartError(armed.error)
          return
        }
      }

      const didStart = await startSession()
      if (!didStart.ok) {
        setStartError(didStart.error)
        return
      }

      store.startTest()
      testStartedAtRef.current = Date.now()
      setDissolvedCount(0)
      startTimer()
    } else {
      store.startTest()
      testStartedAtRef.current = Date.now()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.mode, store.prompt.length, loadPrompt, armSession, startSession, resetProvider, startTimer])

  const handleStop = useCallback(() => {
    const s = useTestStore.getState()
    if (s.mode === 'speed') {
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
      s.setDiffResult(diff, score, grade)
      s.setTestState('ended')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopTimer, finalizeSpeed])

  const handleRetry = useCallback(() => {
    setIsPersonalBest(false)
    setStartError(null)
    setDissolvedCount(0)
    testStartedAtRef.current = null
    resetProvider()
    const s = useTestStore.getState()
    s.resetTest()
    resetTimer(s.duration)
    const last = s.prompt.join(' ')
    const text = regeneratePrompt(s.promptType as PromptMode, s.duration, last, s.customPromptText)
    useTestStore.getState().setPrompt(splitPrompt(text))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetProvider, resetTimer])

  const handleNext = useCallback(() => {
    setIsPersonalBest(false)
    setStartError(null)
    setDissolvedCount(0)
    testStartedAtRef.current = null
    resetProvider()
    const s = useTestStore.getState()
    const last = s.prompt.join(' ')
    s.resetTest()
    resetTimer(s.duration)
    const s2 = useTestStore.getState()
    const text = regeneratePrompt(s2.promptType as PromptMode, s2.duration, last, s2.customPromptText)
    s2.setPrompt(splitPrompt(text))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetProvider, resetTimer])

  const handlePractice = useCallback(() => {
    setIsPersonalBest(false)
    setDissolvedCount(0)
    testStartedAtRef.current = null
    resetProvider()
    const s = useTestStore.getState()
    // Collect missed/substituted words from the last diff result
    const missedWords = (s.results?.diff ?? [])
      .filter((w) => w.tag === 'missed' || w.tag === 'substituted')
      .map((w) => w.tag === 'substituted' ? (w.expected ?? w.word) : w.word)
    s.resetTest()
    resetTimer(s.duration)
    const practiceText = generatePracticePrompt(missedWords, s.duration)
    useTestStore.getState().setPrompt(splitPrompt(practiceText))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetProvider, resetTimer])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  const handleStopRef = useRef(handleStop)
  useEffect(() => { handleStopRef.current = handleStop }, [handleStop])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return

      if (e.key === 'Tab') {
        e.preventDefault()
        if (store.testState === 'running') handleStop()
        else if (store.testState === 'ended') handleRetry()
        else {
          setDissolvedCount(0)
          testStartedAtRef.current = null
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
  }, [store.testState, store.duration, handleRetry, handleNext, handleStop, handleStart, resetTimer, resetProvider])

  // ── Render ────────────────────────────────────────────────────────────────
  const isRunning = store.testState === 'running'
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
            wordCount={
              store.mode === 'clarity'
                ? store.clarityTranscript.trim().split(/\s+/).filter(Boolean).length
                : confirmedWords.length
            }
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
                {store.mode === 'speed' ? (
                  <div className="flex flex-col w-full gap-10">
                    <TestArea
                      words={store.prompt}
                      dissolvedCount={dissolvedCount}
                      isActive={isRunning}
                    />
                    {isIdle && (
                      <div className="flex flex-col items-center gap-3 w-full">
                        {startError && (
                          <div
                            role="alert"
                            style={{
                              background: 'color-mix(in srgb, var(--error, #f87171) 15%, var(--bg))',
                              border: '1px solid var(--error, #f87171)',
                              borderRadius: '0.5rem',
                              padding: '0.5rem 1rem',
                              color: 'var(--fg)',
                              fontSize: '0.85rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '1rem',
                              maxWidth: 480,
                              width: '100%',
                            }}
                          >
                            <span>{startError}</span>
                            <button
                              onClick={() => setStartError(null)}
                              aria-label="Dismiss error"
                              style={{ cursor: 'pointer', opacity: 0.7, background: 'none', border: 'none', color: 'inherit', fontSize: '1rem', lineHeight: 1, padding: 0 }}
                            >
                              ✕
                            </button>
                          </div>
                        )}
                        <MicButton onStart={handleStart} micState={store.micState} />
                      </div>
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
                    onStart={handleStart}
                  />
                )}
              </div>

              {store.mode === 'speed' && (
                <>
                  <WaveformVisualiser
                    stream={micStream}
                    isActive={isRunning}
                    hasError={false}
                  />

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
        </AnimatePresence>
      </main>

      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
