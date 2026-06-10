'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { gsap } from 'gsap'

import { useTestStore } from '@/store/testStore'
import { useTimer } from '@/hooks/useTimer'
import { useActiveSpeechProvider } from '@/hooks/useActiveSpeechProvider'
import { generatePrompt, regeneratePrompt, generatePracticePrompt, type PromptMode } from '@/lib/prompts'
import { diffWords, calcClarityScore } from '@/lib/diff'
import { alignTranscriptToPrompt, countFillers } from '@/lib/alignTranscriptToPrompt'
import { netWpmFromChars, rawWpmFromChars } from '@/lib/stats/wpm'
import { computeConsistency } from '@/lib/stats/consistency'
import { buildSessionTimeline, type TimelineSample } from '@/lib/stats/timeline'
import { useSpeakingGame } from '@/hooks/useSpeakingGame'

import Header from '@/components/Header'
import ConfigBar from '@/components/ConfigBar'
import StatsBar from '@/components/StatsBar'
import SpeakingGame from '@/components/game/SpeakingGame'
import MicButton from '@/components/MicButton'
import ClarityInput from '@/components/ClarityInput'
import ResultsPanel from '@/components/ResultsPanel'
import SettingsPanel from '@/components/SettingsPanel'
import HeroFloatingCards from '@/components/decor/HeroFloatingCards'
import HeroMonkey from '@/components/decor/HeroMonkey'
// MicButton kept for clarity mode; HeroMonkey is the CTA for speed idle
function splitPrompt(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

export default function Home() {
  const store = useTestStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isPersonalBest, setIsPersonalBest] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [dissolvedCount, setDissolvedCount] = useState(0)
  const [isEnding, setIsEnding] = useState(false)
  const [micHovered, setMicHovered] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)
  const gameMetricsRef = useRef({ rawWpms: [] as number[] })
  const timelineRef = useRef<TimelineSample[]>([])

  const [testStartedAt, setTestStartedAt] = useState<number | null>(null)
  const testStartedAtRef = useRef<number | null>(null)
  const confirmedWordsRef = useRef<string[]>([])
  const interimTextRef = useRef('')

  const sttProvider = store.settings.sttProvider ?? 'webspeech'
  const {
    interimText,
    previewWords,
    confirmedWords,
    isListening,
    error: sttError,
    micStream,
    audioActive,
    startSession,
    stopSession,
    reset: resetProvider,
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

  const isSpeedRunning = store.testState === 'running' && store.mode === 'speed'

  const speakingGame = useSpeakingGame({
    prompt: store.prompt,
    confirmedWords,
    previewWords,
    isActive: isSpeedRunning,
    startedAt: testStartedAt,
  })

  useEffect(() => {
    if (store.testState !== 'running' || store.mode !== 'speed') return
    setDissolvedCount(Math.min(speakingGame.displayIndex, store.prompt.length))
  }, [store.testState, store.mode, store.prompt.length, speakingGame.displayIndex])

  useEffect(() => {
    gameMetricsRef.current.rawWpms = speakingGame.rawWpms
  }, [speakingGame.rawWpms])

  useEffect(() => {
    const { settings } = store
    const html = document.documentElement
    import('@/lib/themes').then(({ THEMES, applyTheme }) => {
      const theme = THEMES[settings.theme] ?? THEMES.latte
      applyTheme(theme, settings.accentHex)
    })
    html.dataset.font = settings.font
    html.dataset.fontsize = settings.fontSize
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

    const prevWpm = s.settings.lastSpeedWpm
    const deltaWpm = typeof prevWpm === 'number' ? netWpm - prevWpm : null
    s.updateSettings({ lastSpeedWpm: netWpm })

    const metrics = gameMetricsRef.current
    const consistency = computeConsistency(metrics.rawWpms)
    const timeline = buildSessionTimeline(timelineRef.current, diff)

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
      s.setTestState('ended')
      setIsEnding(false)
    }, 1200)
  }, [stopSession])

  const handleTimerEnd = useCallback(() => {
    finalizeSpeed(store.duration)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalizeSpeed, store.duration])

  const { timeRemaining, isWarning, start: startTimer, stop: stopTimer, reset: resetTimer } =
    useTimer(store.duration, handleTimerEnd)

  useEffect(() => {
    if (sttError) store.setMicState('error')
    else if (isListening) store.setMicState('active')
    else if (useTestStore.getState().micState !== 'requesting') store.setMicState('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sttError, isListening])

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

  const handleStart = useCallback(async () => {
    setStartError(null)
    if (store.prompt.length === 0) loadPrompt()

    if (store.mode === 'speed') {
      resetProvider()
      store.setMicState('requesting')

      const didStart = await startSession()
      if (!didStart.ok) {
        store.setMicState('error')
        setStartError(didStart.error ?? 'Could not start speech recognition')
        return
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
    setIsEnding(false)
    gameMetricsRef.current = { rawWpms: [] }
    timelineRef.current = []
    setTestStartedAt(null)
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
    setIsEnding(false)
    gameMetricsRef.current = { rawWpms: [] }
    timelineRef.current = []
    setTestStartedAt(null)
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
    setIsEnding(false)
    gameMetricsRef.current = { rawWpms: [] }
    timelineRef.current = []
    setTestStartedAt(null)
    testStartedAtRef.current = null
    resetProvider()
    const s = useTestStore.getState()
    const missedWords = (s.results?.diff ?? [])
      .filter((w) => w.tag === 'missed' || w.tag === 'substituted')
      .map((w) => w.tag === 'substituted' ? (w.expected ?? w.word) : w.word)
    s.resetTest()
    resetTimer(s.duration)
    const practiceText = generatePracticePrompt(missedWords, s.duration)
    useTestStore.getState().setPrompt(splitPrompt(practiceText))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetProvider, resetTimer])

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
          setIsEnding(false)
          gameMetricsRef.current = { rawWpms: [] }
          timelineRef.current = []
          setTestStartedAt(null)
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

  // Hero entrance animation
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

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <Header onSettingsOpen={() => setSettingsOpen(true)} />

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
          store.mode === 'speed' ? (isIdle ? 'max-w-[1180px]' : 'max-w-[900px]') : 'max-w-3xl'
        } ${isIdle ? 'justify-start' : 'justify-center'}`}
      >
        {!isEnded ? (
          <div className="relative w-full flex flex-col items-stretch">
            {store.mode === 'speed' ? (
              <div className="flex flex-col w-full gap-8">
                {/* Idle hero */}
                {isIdle && (
                  <div
                    ref={heroRef}
                    className="hero-shell hero-stage"
                    data-mic-hovered={micHovered ? 'true' : 'false'}
                  >
                    <div className="hero-stage-content">
                      <div className="hero-animate hero-title-block">
                        <h1 className="hero-title font-display font-black">
                          how fast<span className="hero-title-accent">⚡</span>can you speak{' '}
                          <span className="hero-title-emoji">🙊</span>
                        </h1>
                        <p className="hero-subtitle font-mono">
                          read it. say it.{' '}
                          <span className="hero-subtitle-highlight">beat your score.</span>
                        </p>
                      </div>

                      {startError && (
                        <div
                          role="alert"
                          className="hero-animate clean-card-sm px-4 py-3 flex items-center justify-between gap-4 w-full max-w-md"
                          style={{
                            background: 'color-mix(in srgb, var(--error) 12%, var(--surface))',
                            color: 'var(--error)',
                            fontSize: '0.85rem',
                          }}
                        >
                          <span className="font-mono">{startError}</span>
                          <button
                            onClick={() => setStartError(null)}
                            aria-label="Dismiss error"
                            style={{ cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', fontSize: '1rem' }}
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="hero-cta-zone hero-animate">
                      <HeroFloatingCards />
                      <HeroMonkey
                        onStart={handleStart}
                        micState={store.micState}
                        onHoverChange={setMicHovered}
                      />
                    </div>
                  </div>
                )}

                {/* Running — live test card */}
                {(isRunning || isEnding) && (
                  <>
                    {sttError && (
                      <div
                        role="alert"
                        className="clean-card-sm px-4 py-3 flex items-center justify-between gap-4 w-full mb-4"
                        style={{
                          background: 'color-mix(in srgb, var(--error) 12%, var(--surface))',
                          color: 'var(--error)',
                          fontSize: '0.85rem',
                        }}
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
                    />
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
                onStart={handleStart}
              />
            )}
          </div>
        ) : (
          <ResultsPanel
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
      </main>

      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
