'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { gsap } from 'gsap'
import { generateShareCard } from '@/lib/shareCard'
import SessionGraph from '@/components/game/SessionGraph'
import { resolveResultsTimeline } from '@/lib/stats/timeline'
import { useTestStore } from '@/store/testStore'
import type { DiffWord, SpeedResults } from '@/store/testStore'

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
  border: '3px solid var(--border)',
  boxShadow: '4px 4px 0 var(--shadow)',
  fontSize: 'var(--test-font-size, 1.05rem)',
  lineHeight: 'var(--test-line-height, 1.75)',
  background: 'var(--surface)',
}

function MetricCard({
  label,
  value,
  delta,
  tone,
  icon,
}: {
  label: string
  value: string | number
  delta?: string | null
  tone: 'accent' | 'success' | 'muted' | 'warn'
  icon: React.ReactNode
}) {
  return (
    <div className="results-metric stat-card">
      <div className="results-metric-head">
        <div className={`results-metric-icon results-metric-icon--${tone}`}>
          {icon}
        </div>
        <span className="stat-label">{label}</span>
      </div>
      <span className="results-metric-value">{value}</span>
      {delta && (
        <span className="font-mono text-xs font-semibold" style={{ color: 'var(--success)' }}>
          {delta}
        </span>
      )}
    </div>
  )
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
  const [displayWpm, setDisplayWpm] = useState(0)
  const [showDetail, setShowDetail] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const detailRef = useRef<HTMLDivElement | null>(null)
  const revealRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    setShowStats(false)
    setDisplayWpm(0)
    const ctx = gsap.context(() => {
      if (mode === 'speed' && results) {
        const tl = gsap.timeline({
          onComplete: () => setShowStats(true),
        })
        tl.from('.session-reveal', {
          scale: 1.15,
          opacity: 0,
          duration: 0.8,
          ease: 'power3.out',
        })
        tl.to('.session-reveal', {
          scale: 1,
          duration: 0.5,
          ease: 'power2.inOut',
        }, '-=0.3')
        tl.call(() => {
          gsap.from('.stat-card', {
            opacity: 0,
            y: 24,
            stagger: 0.07,
            duration: 0.5,
            ease: 'power3.out',
          })
        })
        const wpmObj = { val: 0 }
        gsap.to(wpmObj, {
          val: results.netWpm,
          duration: 1.2,
          ease: 'power2.out',
          delay: 0.35,
          onUpdate: () => setDisplayWpm(Math.round(wpmObj.val)),
        })
        gsap.fromTo(
          '.accuracy-fill',
          { width: '0%' },
          { width: `${results.accuracy}%`, duration: 0.9, ease: 'power2.out', delay: 0.7 }
        )
      } else {
        gsap.from('.stat-card', {
          opacity: 0,
          y: 24,
          stagger: 0.07,
          duration: 0.5,
          ease: 'power3.out',
          delay: 0.15,
        })
      }

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

  useEffect(() => {
    if (!showDetail || !detailRef.current) return
    const ctx = gsap.context(() => {
      gsap.from('.detail-word', {
        opacity: 0,
        y: 6,
        stagger: 0.012,
        duration: 0.25,
        ease: 'power2.out',
      })
    }, detailRef)
    return () => ctx.revert()
  }, [showDetail])

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

  const renderDelta = () => {
    if (!results) return null
    const d = results.deltaWpm
    if (d === null) return <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>first run</span>
    if (d === 0) return <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>even with last run</span>
    const up = d > 0
    return (
      <span className="font-mono text-xs font-semibold" style={{ color: up ? 'var(--success)' : 'var(--error)' }}>
        {up ? '▲' : '▼'} {up ? '+' : ''}{d} from last run
      </span>
    )
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
        <div className="results-shell">
          {/* quick recap row */}
          <div
            ref={revealRef}
            className="session-reveal results-summary paper-panel p-5 md:p-6 flex flex-col items-center gap-3 text-center"
          >
            <p className="stat-label">session complete</p>
            <div className="flex flex-wrap items-center justify-center gap-5 font-mono text-sm" style={{ color: 'var(--text-stats)' }}>
              <span>avg wpm <strong style={{ color: 'var(--text-active)' }}>{results.netWpm}</strong></span>
              <span>accuracy <strong style={{ color: 'var(--text-active)' }}>{results.accuracy}%</strong></span>
              <span>consistency <strong style={{ color: 'var(--text-active)' }}>{results.consistency}%</strong></span>
            </div>
          </div>

          {/* wpm + live pace graph side by side */}
          <div
            className={`results-hero paper-panel stat-card ${isPersonalBest ? 'results-hero--pb' : ''} ${showStats ? '' : 'opacity-0'}`}
          >
            <div className="results-hero-score">
              <div className="flex items-end gap-2">
                <span
                  className="results-hero-wpm"
                  aria-label={`${results.netWpm} words per minute`}
                >
                  {displayWpm}
                </span>
                <span className="font-display text-sm font-bold mb-1 uppercase" style={{ color: 'var(--text-stats)' }}>
                  wpm
                </span>
              </div>

              {renderDelta()}

              {isPersonalBest && (
                <div className="flex items-center gap-2 mt-1">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--success)" aria-hidden>
                    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2 3h10v-2H7v2z" />
                  </svg>
                  <span className="font-display text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--success)' }}>
                    new personal best
                  </span>
                </div>
              )}
              {!isPersonalBest && personalBestWpm != null && personalBestWpm > 0 && (
                <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                  best {personalBestWpm} wpm
                </span>
              )}
            </div>

            {graphTimeline && (
              <div className="results-hero-graph">
                <SessionGraph
                  timeline={graphTimeline}
                  durationSec={duration}
                  compact
                  showMomentum={false}
                />
              </div>
            )}
          </div>

          {/* secondary stats. all theme vars, no random purple hex */}
          <div className={`results-metrics ${showStats ? '' : 'opacity-0'}`}>
            <MetricCard
              label="accuracy"
              value={`${results.accuracy}%`}
              delta={results.accuracy >= 90 ? `↑ ${results.accuracy}%` : null}
              tone="success"
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
                </svg>
              }
            />
            <MetricCard
              label="consistency"
              value={`${results.consistency}%`}
              tone="accent"
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              }
            />
            <MetricCard
              label="raw wpm"
              value={results.rawWpm}
              tone="accent"
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
              }
            />
            <MetricCard
              label="words spoken"
              value={spokenWordCount}
              tone="muted"
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-stats)" strokeWidth="2.5">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              }
            />
            <MetricCard
              label="fillers"
              value={results.fillerCount}
              tone="warn"
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2.5">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              }
            />
          </div>

          {/* word breakdown bar */}
          <div className="note-panel stat-card flex flex-col gap-3 p-5">
            <p className="stat-label">breakdown</p>
            <div className="accuracy-track">
              <div className="accuracy-fill" style={{ width: 0 }} />
            </div>
            <div className="flex items-baseline justify-between font-mono text-xs">
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{results.accuracy}% correct</span>
              <span style={{ color: 'var(--text-stats)' }}>{diffCounts.correct} / {promptCount} words</span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs" style={{ color: 'var(--text-stats)' }}>
              <span><span className="diff-correct">■</span> correct · {diffCounts.correct}</span>
              <span><span className="diff-substituted">■</span> wrong · {diffCounts.substituted}</span>
              <span><span className="diff-missed">■</span> missed · {diffCounts.missed}</span>
            </div>
          </div>

          {/* Detailed breakdown */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setShowDetail((v) => !v)}
              className="self-start font-mono text-xs font-bold tracking-wide cursor-pointer flex items-center gap-1.5"
              style={{ color: 'var(--text-stats)', background: 'none', border: 'none', padding: 0 }}
              aria-expanded={showDetail}
            >
              <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: showDetail ? 'rotate(90deg)' : 'rotate(0deg)' }}>▸</span>
              detailed breakdown
            </button>

            {showDetail && (
              <div ref={detailRef} className="flex flex-col gap-6">
                <div className="min-w-0">
                  <p className="stat-label mb-3">expected · hover wrong words</p>
                  <div className="leading-relaxed p-4 max-h-[min(32vh,22rem)] overflow-y-auto" style={reviewBoxStyle}>
                    {results.diff.map((w, i) => (
                      <span
                        key={i}
                        className={`detail-word diff-word inline-block mr-[0.35em] ${TAG_CLASS[w.tag]}`}
                        title={
                          w.tag === 'substituted' && w.expected
                            ? `you said "${w.word}" · expected "${w.expected}"`
                            : w.tag === 'missed' ? 'not captured' : w.tag
                        }
                      >
                        {w.tag === 'substituted' ? w.expected ?? w.word : w.word}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="stat-label mb-3">you said · transcribed</p>
                  <div className="leading-relaxed p-4 max-h-[min(32vh,22rem)] overflow-y-auto" style={{ ...reviewBoxStyle, color: 'var(--text-active)' }}>
                    {results.transcript.trim()
                      ? results.transcript.trim().split(/\s+/).map((w, i) => (
                          <span key={i} className="detail-word inline-block mr-[0.35em]">{w}</span>
                        ))
                      : <span style={{ color: 'var(--text-muted)' }}>nothing transcribed</span>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" id="btn-retry" onClick={onRetry} className="desk-btn desk-btn-primary flex-1 sm:flex-none">
                try again
              </button>
              <button type="button" id="btn-next" onClick={onNext} className="desk-btn desk-btn-quiet flex-1 sm:flex-none">
                new test
              </button>
              {onPractice && diffCounts.missed + diffCounts.substituted > 0 && (
                <button type="button" id="btn-practice" onClick={onPractice} className="desk-btn desk-btn-quiet">
                  practice missed
                </button>
              )}
              <button type="button" id="btn-share" onClick={handleShare} className="desk-btn desk-btn-quiet">
                share
              </button>
            </div>
            <p className="font-mono text-xs" style={{ color: 'var(--text-stats)' }}>
              tab · retry &nbsp;&nbsp; enter · next
            </p>
          </div>
        </div>
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
    </div>
  )
}
