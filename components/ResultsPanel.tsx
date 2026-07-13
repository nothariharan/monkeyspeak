'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { gsap } from 'gsap'
import { generateShareCard } from '@/lib/shareCard'
import { resolveResultsTimeline } from '@/lib/stats/timeline'
import { calculateSpeakingStreak } from '@/lib/stats/streak'
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
        <div className="grid w-full max-w-[1200px] py-8 md:py-10 items-start gap-10 md:gap-12 grid-cols-1 md:grid-cols-2">
          <div className="min-w-0">
            <p className="stat-label mb-4">transcript diff</p>
            <div
              className="leading-loose p-4 mb-6 max-h-[min(28rem,50vh)] overflow-y-auto"
              style={{ ...reviewBoxStyle, fontSize: '0.95rem', lineHeight: '2rem' }}
            >
              {diffResult.map((w, i) => (
                <span
                  key={i}
                  className={`diff-word inline-block mr-[0.4em] ${TAG_CLASS[w.tag]}`}
                  title={w.tag === 'substituted' ? `expected: ${w.expected}` : w.tag}
                >
                  {w.word}
                </span>
              ))}
            </div>
            <div className="font-mono text-xs flex flex-wrap gap-4" style={{ color: 'var(--text-stats)' }}>
              <span><span className="diff-correct">■</span> correct</span>
              <span><span className="diff-substituted">■</span> wrong word</span>
              <span><span className="diff-missed">■</span> missed</span>
              <span><span className="diff-added">■</span> extra</span>
            </div>
          </div>

          <div className="min-w-0 flex flex-col gap-8">
            <div className="paper-panel stat-card p-6 flex items-baseline gap-4 flex-wrap">
              <span
                className="font-display font-black"
                style={{ fontSize: '3.5rem', color: 'var(--accent)', lineHeight: 1 }}
                aria-label={`Clarity score ${clarityScore} percent`}
              >
                {clarityScore}%
              </span>
              <span
                className="font-display font-black text-4xl"
                style={{ color: GRADE_COLOR[clarityGrade] ?? 'var(--text-active)' }}
                aria-label={`Grade ${clarityGrade}`}
              >
                {clarityGrade}
              </span>
            </div>
            <p className="font-mono text-xs" style={{ color: 'var(--text-stats)' }}>
              {promptType} · {duration}s
            </p>

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
            <p className="font-mono text-xs" style={{ color: 'var(--text-stats)' }}>
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
