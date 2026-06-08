'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { gsap } from 'gsap'
import { generateShareCard } from '@/lib/shareCard'
import SessionGraph from '@/components/game/SessionGraph'
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
  iconBg,
  icon,
}: {
  label: string
  value: string | number
  delta?: string | null
  iconBg: string
  icon: React.ReactNode
}) {
  return (
    <div className="stat-card result-card flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div
          className="flex items-center justify-center shrink-0"
          style={{ width: 32, height: 32, background: iconBg, border: '2px solid var(--border)' }}
        >
          {icon}
        </div>
        <span className="stat-label">{label}</span>
      </div>
      <span className="font-display text-2xl font-black" style={{ color: 'var(--text-active)' }}>
        {value}
      </span>
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
        <div className="w-full max-w-[720px] py-8 md:py-10 flex flex-col gap-6">
          {/* Session summary */}
          <div
            ref={revealRef}
            className="session-reveal clean-card p-6 md:p-8 flex flex-col items-center gap-4 text-center"
            style={{ background: 'color-mix(in srgb, var(--accent) 8%, var(--surface))' }}
          >
            <p className="stat-label">session complete</p>
            <div className="flex flex-wrap items-center justify-center gap-6 font-mono text-sm" style={{ color: 'var(--text-stats)' }}>
              <span>avg wpm <strong style={{ color: 'var(--text-active)' }}>{results.netWpm}</strong></span>
              <span>accuracy <strong style={{ color: 'var(--text-active)' }}>{results.accuracy}%</strong></span>
              <span>consistency <strong style={{ color: 'var(--text-active)' }}>{results.consistency}%</strong></span>
            </div>
          </div>

          {/* Hero score block */}
          <div
            className={`clean-card stat-card p-6 md:p-8 flex flex-col gap-3 ${showStats ? '' : 'opacity-0'}`}
            style={{
              background: isPersonalBest
                ? 'color-mix(in srgb, var(--success) 18%, var(--surface))'
                : 'var(--surface)',
            }}
          >
            <div className="flex items-end gap-3 flex-wrap">
              <span
                className="font-display font-black"
                style={{ fontSize: 'clamp(3.5rem, 10vw, 5rem)', color: 'var(--accent)', lineHeight: 0.9 }}
                aria-label={`${results.netWpm} words per minute`}
              >
                {displayWpm}
              </span>
              <span className="font-display text-lg font-bold mb-2 uppercase" style={{ color: 'var(--text-stats)' }}>
                WPM
              </span>
            </div>

            {renderDelta()}

            {isPersonalBest && (
              <div className="flex items-center gap-2 mt-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--accent)" aria-hidden>
                  <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2 3h10v-2H7v2z" />
                </svg>
                <span className="font-display text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                  New Personal Best!
                </span>
              </div>
            )}
            {!isPersonalBest && personalBestWpm != null && personalBestWpm > 0 && (
              <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                best {personalBestWpm} wpm
              </span>
            )}
          </div>

          {/* Metric cards */}
          <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3 ${showStats ? '' : 'opacity-0'}`}>
            <MetricCard
              label="accuracy"
              value={`${results.accuracy}%`}
              delta={results.accuracy >= 90 ? `↑ ${results.accuracy}%` : null}
              iconBg="color-mix(in srgb, var(--success) 20%, var(--surface))"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
                </svg>
              }
            />
            <MetricCard
              label="consistency"
              value={`${results.consistency}%`}
              iconBg="color-mix(in srgb, #8b5cf6 20%, var(--surface))"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              }
            />
            <MetricCard
              label="raw wpm"
              value={results.rawWpm}
              iconBg="color-mix(in srgb, var(--accent) 20%, var(--surface))"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
              }
            />
            <MetricCard
              label="words spoken"
              value={spokenWordCount}
              iconBg="color-mix(in srgb, #8b5cf6 20%, var(--surface))"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              }
            />
            <MetricCard
              label="fillers"
              value={results.fillerCount}
              iconBg="color-mix(in srgb, #eab308 25%, var(--surface))"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2.5">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              }
            />
          </div>

          {results.timeline && results.timeline.wpm.length > 1 && (
            <SessionGraph timeline={results.timeline} durationSec={duration} />
          )}

          {/* Breakdown */}
          <div className="clean-card-sm stat-card flex flex-col gap-3 p-5">
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
              className="self-start font-mono text-xs font-bold uppercase tracking-widest cursor-pointer flex items-center gap-1.5"
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
              <button type="button" id="btn-retry" onClick={onRetry} className="clean-btn clean-btn-filled flex-1 sm:flex-none">
                Try Again
              </button>
              <button type="button" id="btn-next" onClick={onNext} className="clean-btn clean-btn-outline flex-1 sm:flex-none">
                New Test
              </button>
              {onPractice && diffCounts.missed + diffCounts.substituted > 0 && (
                <button type="button" id="btn-practice" onClick={onPractice} className="clean-btn clean-btn-outline">
                  Practice Missed
                </button>
              )}
              <button type="button" id="btn-share" onClick={handleShare} className="clean-btn clean-btn-outline">
                Share
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
            <div className="clean-card stat-card p-6 flex items-baseline gap-4 flex-wrap">
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
              <button type="button" id="btn-retry" onClick={onRetry} className="clean-btn clean-btn-filled">
                Try Again
              </button>
              <button type="button" id="btn-next" onClick={onNext} className="clean-btn clean-btn-outline">
                New Test
              </button>
              <button type="button" id="btn-share" onClick={handleShare} className="clean-btn clean-btn-outline">
                Share
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
