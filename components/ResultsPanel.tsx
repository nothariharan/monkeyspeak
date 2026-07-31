'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { gsap } from 'gsap'
import { generateShareCard } from '@/lib/shareCard'
import { resolveResultsTimeline } from '@/lib/stats/timeline'
import { calculateSpeakingStreak } from '@/lib/stats/streak'
import { calcPunctuationScore } from '@/lib/diff'
import { useTestStore } from '@/store/testStore'
import type { DiffWord, SpeedResults } from '@/store/testStore'
import HistoryDrawer from '@/components/HistoryDrawer'
import SpeedResultsView from '@/components/game/SpeedResultsView'

interface ResultsPanelProps {
  mode: 'speed' | 'clarity'
  results: SpeedResults | null
  duration: number
  promptType: string
  prompt?: string[]
  clarityScore: number
  clarityGrade: 'S' | 'A' | 'B' | 'C' | 'needs work'
  diffResult: DiffWord[]
  isPersonalBest?: boolean
  personalBestWpm?: number
  onRetry: () => void
  onNext: () => void
  onPractice?: () => void
}

const GRADE_COLOR: Record<string, string> = {
  S: '#eab308',
  A: '#22c55e',
  B: '#3b82f6',
  C: '#f97316',
  'needs work': '#ef4444',
}

const TAG_CLASS: Record<DiffWord['tag'], string> = {
  correct: 'diff-correct',
  substituted: 'diff-substituted',
  missed: 'diff-missed',
  added: 'diff-added',
}

const reviewBoxStyle: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--border) 55%, transparent)',
  boxShadow: 'var(--shadow-soft-sm)',
  fontSize: 'var(--test-font-size, 1.05rem)',
  lineHeight: 'var(--test-line-height, 1.75)',
  background: 'var(--surface)',
  borderRadius: 'var(--radius)',
}

export default function ResultsPanel({
  mode,
  results,
  duration,
  promptType,
  prompt = [],
  clarityScore,
  clarityGrade,
  diffResult,
  isPersonalBest = false,
  personalBestWpm,
  onRetry,
  onNext,
  onPractice,
}: ResultsPanelProps) {
  const settings = useTestStore((s) => s.settings)
  const clarityToolName = useTestStore((s) => s.clarityToolName)
  const clarityTranscript = useTestStore((s) => s.clarityTranscript)
  const [historyOpen, setHistoryOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const streakDays = calculateSpeakingStreak(settings.speakingActivity)

  const diffCounts = results?.diff
    ? {
        correct: results.diff.filter((w) => w.tag === 'correct').length,
        missed: results.diff.filter((w) => w.tag === 'missed').length,
        substituted: results.diff.filter((w) => w.tag === 'substituted').length,
      }
    : { correct: 0, missed: 0, substituted: 0 }

  const clarityDiffCounts = useMemo(() => {
    const counts = { correct: 0, substituted: 0, missed: 0, added: 0 }
    for (const word of diffResult) counts[word.tag] += 1
    return counts
  }, [diffResult])

  const punctuationScore = useMemo(() => {
    if (mode !== 'clarity') return 0
    const promptStr = prompt.join(' ')
    if (!promptStr.trim()) return 0
    return calcPunctuationScore(promptStr, clarityTranscript)
  }, [mode, prompt, clarityTranscript])

  const priorBestClarity = useMemo(() => {
    const runs = settings.sessionHistory.filter((entry) => entry.mode === 'clarity')
    // history already includes this run at the front after stop — compare to previous best
    const prior = runs.slice(1)
    if (prior.length === 0) return null
    return prior.reduce((best, entry) => (entry.accuracy > best.accuracy ? entry : best))
  }, [settings.sessionHistory])

  const vsBest =
    priorBestClarity != null ? clarityScore - priorBestClarity.accuracy : null

  const promptCount = results?.diff.length ?? 0
  const spokenWordCount = results?.transcript
    ? results.transcript.trim().split(/\s+/).filter(Boolean).length
    : results?.diff.filter((w) => w.tag !== 'missed').length ?? 0

  const graphTimeline = results
    ? resolveResultsTimeline(
        results.timeline,
        results.netWpm,
        results.rawWpm,
        duration,
        results.elapsedSec
      )
    : null

  // re-sync theme when results open. zustand hydrate can race the first paint.
  useEffect(() => {
    if (mode !== 'speed' || !results) return
    import('@/lib/themes').then(({ THEMES, applyTheme }) => {
      const theme = THEMES[settings.theme] ?? THEMES.latte
      applyTheme(theme, settings.accentHex)
    })
  }, [mode, results, settings.theme, settings.accentHex])

  // clarity mode keeps its diff-word reveal. speed mode animations now live
  // inside SpeedResultsView, so nothing to orchestrate here for it.
  useEffect(() => {
    const ctx = gsap.context(() => {
      if (mode === 'clarity') {
        gsap.from('.diff-word', {
          opacity: 0,
          scale: 0.85,
          stagger: 0.018,
          duration: 0.25,
          ease: 'back.out(1.4)',
          delay: 0.4,
        })
      }
    }, panelRef)

    return () => ctx.revert()
  }, [mode, results])

  const handleShare = () => {
    if (mode === 'speed' && results) {
      generateShareCard({
        mode: 'speed',
        wpm: results.netWpm,
        accuracy: results.accuracy,
        fillerCount: results.fillerCount,
        duration,
        promptType,
      })
    } else {
      generateShareCard({ mode: 'clarity', clarityScore, clarityGrade })
    }
  }

  return (
    <div
      ref={panelRef}
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto"
      style={{ padding: 'clamp(1rem, 4vw, 2.5rem)', background: 'var(--bg)' }}
      role="dialog"
      aria-label="Test results"
    >
      {mode === 'speed' && results ? (
        <SpeedResultsView
          netWpm={results.netWpm}
          rawWpm={results.rawWpm}
          accuracy={results.accuracy}
          consistency={results.consistency}
          fillerCount={results.fillerCount}
          wordsSpoken={spokenWordCount}
          deltaWpm={results.deltaWpm}
          isPersonalBest={isPersonalBest}
          personalBestWpm={personalBestWpm}
          correct={diffCounts.correct}
          wrong={diffCounts.substituted}
          missed={diffCounts.missed}
          total={promptCount}
          timeline={graphTimeline ?? { raw: [], wpm: [], momentum: [], errors: [] }}
          durationSec={duration}
          streakDays={streakDays}
          diff={results.diff}
          transcript={results.transcript}
          promptType={promptType}
          onRetry={onRetry}
          onNext={onNext}
          onPractice={onPractice}
          onShare={handleShare}
          onHistory={() => setHistoryOpen(true)}
        />
      ) : mode === 'clarity' ? (
        <div className="clarity-results grid w-full max-w-[1200px] py-8 md:py-10 items-start gap-10 md:gap-12 grid-cols-1 md:grid-cols-2">
          <div className="min-w-0">
            <p className="clarity-results-kicker mb-4">transcript diff</p>
            <div
              className="clarity-results-diff leading-loose p-4 mb-6 max-h-[min(28rem,50vh)] overflow-y-auto"
              style={{ ...reviewBoxStyle, fontSize: '0.95rem', lineHeight: '2rem' }}
            >
              {diffResult.length > 0 ? (
                diffResult.map((w, i) => (
                  <span
                    key={i}
                    className={`diff-word inline-block mr-[0.4em] ${TAG_CLASS[w.tag]}`}
                    title={w.tag === 'substituted' ? `expected: ${w.expected}` : w.tag}
                  >
                    {w.word}
                  </span>
                ))
              ) : (
                <span className="clarity-results-meta">no transcript to compare yet</span>
              )}
            </div>
            <div className="clarity-results-legend flex flex-wrap gap-4">
              <span><span className="diff-correct">■</span> correct</span>
              <span><span className="diff-substituted">■</span> wrong word</span>
              <span><span className="diff-missed">■</span> missed</span>
              <span><span className="diff-added">■</span> extra</span>
            </div>
          </div>

          <div className="min-w-0 flex flex-col gap-6">
            <div className="paper-panel clarity-results-hero">
              <div className="clarity-results-hero-top">
                <span className="clarity-results-kicker">clarity score</span>
                {clarityToolName ? (
                  <span className="clarity-results-engine" title="engine tested">
                    {clarityToolName}
                  </span>
                ) : null}
              </div>
              <div className="clarity-results-hero-score">
                <span
                  className="clarity-results-pct font-display font-black"
                  aria-label={`Clarity score ${clarityScore} percent`}
                >
                  {clarityScore}%
                </span>
                <span
                  className="clarity-results-grade font-display font-black"
                  style={{ color: GRADE_COLOR[clarityGrade] ?? 'var(--text-active)' }}
                  aria-label={`Grade ${clarityGrade}`}
                >
                  {clarityGrade}
                </span>
              </div>
              <p className="clarity-results-meta">
                {promptType}
                {vsBest != null ? (
                  <>
                    {' · '}
                    <span className={vsBest >= 0 ? 'clarity-results-delta is-up' : 'clarity-results-delta is-down'}>
                      {vsBest >= 0 ? '+' : ''}
                      {vsBest}% vs your best
                    </span>
                  </>
                ) : (
                  ' · first clarity run'
                )}
              </p>
            </div>

            <div className="clarity-results-chips" aria-label="Result breakdown">
              <div className="clarity-results-chip">
                <span className="clarity-results-chip-value tabular-nums diff-correct">{clarityDiffCounts.correct}</span>
                <span className="clarity-results-chip-label">correct</span>
              </div>
              <div className="clarity-results-chip">
                <span className="clarity-results-chip-value tabular-nums diff-substituted">{clarityDiffCounts.substituted}</span>
                <span className="clarity-results-chip-label">wrong</span>
              </div>
              <div className="clarity-results-chip">
                <span className="clarity-results-chip-value tabular-nums diff-missed">{clarityDiffCounts.missed}</span>
                <span className="clarity-results-chip-label">missed</span>
              </div>
              <div className="clarity-results-chip">
                <span className="clarity-results-chip-value tabular-nums diff-added">{clarityDiffCounts.added}</span>
                <span className="clarity-results-chip-label">extra</span>
              </div>
              <div className="clarity-results-chip clarity-results-chip--accent">
                <span className="clarity-results-chip-value tabular-nums">{punctuationScore}%</span>
                <span className="clarity-results-chip-label">punctuation</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" id="btn-retry" onClick={onRetry} className="desk-btn desk-btn-primary">
                try again
              </button>
              <button type="button" id="btn-next" onClick={onNext} className="desk-btn desk-btn-quiet">
                new test
              </button>
              <button type="button" id="btn-share" onClick={handleShare} className="desk-btn desk-btn-quiet">
                share
              </button>
            </div>
            <p className="clarity-results-meta">
              tab · retry &nbsp;&nbsp; enter · next
            </p>
          </div>
        </div>
      ) : null}

      <HistoryDrawer
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  )
}
