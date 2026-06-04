'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { gsap } from 'gsap'
import { generateShareCard } from '@/lib/shareCard'
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
  S: '#e8c96a',
  A: '#6ae8a8',
  B: '#6ab0e8',
  C: '#f09050',
  'needs work': '#ca4754',
}

const TAG_CLASS: Record<DiffWord['tag'], string> = {
  correct: 'diff-correct',
  substituted: 'diff-substituted',
  missed: 'diff-missed',
  added: 'diff-added',
}

const reviewBoxStyle: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--text-muted) 45%, transparent)',
  fontSize: 'var(--test-font-size, 1.05rem)',
  lineHeight: 'var(--test-line-height, 1.75)',
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-card result-card flex flex-col gap-1">
      <span className="text-[0.65rem] font-mono uppercase tracking-wider" style={{ color: 'var(--text-stats)' }}>
        {label}
      </span>
      <span className="font-mono text-2xl" style={{ color: 'var(--accent)' }}>
        {value}
      </span>
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
  const panelRef = useRef<HTMLDivElement | null>(null)
  const detailRef = useRef<HTMLDivElement | null>(null)

  const sectionLabelStyle: CSSProperties = { color: 'var(--text-stats)' }

  // Per-state counts from the prompt diff
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

  // ── GSAP reveal on mount ──────────────────────────────────────────────────
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.stat-card', {
        opacity: 0,
        y: 24,
        stagger: 0.07,
        duration: 0.5,
        ease: 'power3.out',
        delay: 0.15,
      })

      // Accuracy bar fills after the cards settle
      if (mode === 'speed' && results) {
        gsap.fromTo(
          '.accuracy-fill',
          { width: '0%' },
          { width: `${results.accuracy}%`, duration: 0.9, ease: 'power2.out', delay: 0.55 }
        )
        const obj = { val: 0 }
        gsap.to(obj, {
          val: results.netWpm,
          duration: 1.2,
          ease: 'power2.out',
          delay: 0.2,
          onUpdate: () => setDisplayWpm(Math.round(obj.val)),
        })
      }

      // Clarity diff cascade (speed diff lives in the on-demand detail panel)
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

  // ── Cascade the detailed diff words when the section opens ─────────────────
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
      gsap.fromTo(
        '.detail-word.diff-substituted',
        { x: -3 },
        { keyframes: { x: [-3, 3, -2, 2, 0] }, duration: 0.4, ease: 'none', stagger: 0.02, delay: 0.2 }
      )
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

  // ── Delta line under the hero WPM ─────────────────────────────────────────
  const renderDelta = () => {
    if (!results) return null
    const d = results.deltaWpm
    if (d === null) {
      return <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>first run</span>
    }
    if (d === 0) {
      return <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>even with last run</span>
    }
    const up = d > 0
    return (
      <span className="text-xs font-mono" style={{ color: up ? '#6ae8a8' : 'var(--error)' }}>
        {up ? '▲' : '▼'} {up ? '+' : ''}{d} from last run
      </span>
    )
  }

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto"
      style={{ padding: 'clamp(1rem, 4vw, 2.5rem)', background: 'var(--bg)' }}
      role="dialog"
      aria-label="Test results"
    >
      {mode === 'speed' && results ? (
        <div className="w-full max-w-[680px] py-8 md:py-10 flex flex-col gap-8">
          {/* Hero */}
          <div className="flex flex-col gap-2">
            <div className="flex items-end gap-3">
              <span
                className="font-mono font-bold stat-card"
                style={{ fontSize: '4.5rem', color: 'var(--accent)', lineHeight: 0.9 }}
                aria-label={`${results.netWpm} words per minute`}
              >
                {displayWpm}
              </span>
              <span className="text-sm font-mono mb-2" style={{ color: 'var(--text-stats)' }}>wpm</span>
            </div>
            <div className="flex items-center gap-3">{renderDelta()}</div>
            {isPersonalBest && (
              <span
                className="stat-card self-start mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono"
                style={{
                  background: 'color-mix(in srgb, var(--accent) 18%, transparent)',
                  color: 'var(--accent)',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2 3h10v-2H7v2z" />
                </svg>
                new personal best
              </span>
            )}
            {!isPersonalBest && personalBestWpm != null && personalBestWpm > 0 && (
              <span className="text-xs font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
                best {personalBestWpm} wpm
              </span>
            )}
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="accuracy" value={`${results.accuracy}%`} />
            <StatCard label="raw wpm" value={results.rawWpm} />
            <StatCard label="words spoken" value={spokenWordCount} />
            <StatCard label="fillers" value={results.fillerCount} />
          </div>

          {/* Breakdown */}
          <div className="flex flex-col gap-3 stat-card">
            <p className="text-xs font-mono uppercase tracking-widest" style={sectionLabelStyle}>
              breakdown
            </p>
            <div className="accuracy-track">
              <div className="accuracy-fill" style={{ width: 0 }} />
            </div>
            <div className="flex items-baseline justify-between text-xs font-mono">
              <span style={{ color: 'var(--accent)' }}>{results.accuracy}% correct</span>
              <span style={{ color: 'var(--text-stats)' }}>
                {diffCounts.correct} / {promptCount} words
              </span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-mono" style={{ color: 'var(--text-stats)' }}>
              <span><span className="diff-correct">■</span> correct · {diffCounts.correct}</span>
              <span><span className="diff-substituted">■</span> wrong · {diffCounts.substituted}</span>
              <span><span className="diff-missed">■</span> missed · {diffCounts.missed}</span>
            </div>
          </div>

          {/* Detailed breakdown (on demand) */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setShowDetail((v) => !v)}
              className="self-start inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest cursor-pointer"
              style={{ color: 'var(--text-stats)', background: 'none', border: 'none', padding: 0 }}
              aria-expanded={showDetail}
            >
              <span
                style={{
                  display: 'inline-block',
                  transition: 'transform 0.2s ease',
                  transform: showDetail ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              >
                ▸
              </span>
              detailed breakdown
            </button>

            {showDetail && (
              <div ref={detailRef} className="flex flex-col gap-6">
                {/* Expected (prompt) with diff coloring */}
                <div className="min-w-0">
                  <p className="text-xs font-mono uppercase tracking-widest mb-3" style={sectionLabelStyle}>
                    expected · hover wrong words
                  </p>
                  <div className="leading-relaxed rounded p-4 max-h-[min(32vh,22rem)] overflow-y-auto" style={reviewBoxStyle}>
                    {results.diff.map((w, i) => (
                      <span
                        key={i}
                        className={`detail-word diff-word inline-block mr-[0.35em] ${TAG_CLASS[w.tag]}`}
                        title={
                          w.tag === 'substituted' && w.expected
                            ? `you said "${w.word}" · expected "${w.expected}"`
                            : w.tag === 'missed'
                              ? 'not captured'
                              : w.tag
                        }
                      >
                        {w.tag === 'substituted' ? w.expected ?? w.word : w.word}
                      </span>
                    ))}
                  </div>
                </div>

                {/* You said (raw transcript) */}
                <div className="min-w-0">
                  <p className="text-xs font-mono uppercase tracking-widest mb-3" style={sectionLabelStyle}>
                    you said · transcribed
                  </p>
                  <div
                    className="leading-relaxed rounded p-4 max-h-[min(32vh,22rem)] overflow-y-auto"
                    style={{ ...reviewBoxStyle, color: 'var(--text-active)' }}
                  >
                    {results.transcript.trim()
                      ? results.transcript
                          .trim()
                          .split(/\s+/)
                          .map((w, i) => (
                            <span key={i} className="detail-word inline-block mr-[0.35em]">
                              {w}
                            </span>
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
              <button type="button" id="btn-retry" onClick={onRetry} className="pill-btn active px-4 py-2">
                retry
              </button>
              <button type="button" id="btn-next" onClick={onNext} className="pill-btn px-4 py-2">
                next test
              </button>
              {onPractice && diffCounts.missed + diffCounts.substituted > 0 && (
                <button type="button" id="btn-practice" onClick={onPractice} className="pill-btn px-4 py-2">
                  practice missed
                </button>
              )}
              <button type="button" id="btn-share" onClick={handleShare} className="pill-btn px-4 py-2">
                share
              </button>
            </div>
            <p className="text-xs font-mono" style={{ color: 'var(--text-stats)' }}>
              tab · retry &nbsp;&nbsp; enter · next
            </p>
          </div>
        </div>
      ) : mode === 'clarity' ? (
        <div className="grid w-full max-w-[1200px] py-8 md:py-10 items-start gap-10 md:gap-12 grid-cols-1 md:grid-cols-2">
          <div className="min-w-0">
            <p className="text-xs font-mono uppercase tracking-widest mb-4" style={sectionLabelStyle}>
              transcript diff
            </p>
            <div
              className="leading-loose rounded p-4 mb-6 max-h-[min(28rem,50vh)] overflow-y-auto"
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
            <div className="text-xs font-mono flex flex-wrap gap-4" style={{ color: 'var(--text-stats)' }}>
              <span><span className="diff-correct">■</span> correct</span>
              <span><span className="diff-substituted">■</span> wrong word</span>
              <span><span className="diff-missed">■</span> missed</span>
              <span><span className="diff-added">■</span> extra</span>
            </div>
          </div>

          <div className="min-w-0 flex flex-col gap-8">
            <div className="flex items-baseline gap-4 flex-wrap">
              <span
                className="font-mono font-semibold stat-card"
                style={{ fontSize: '3.5rem', color: 'var(--accent)', lineHeight: 1 }}
                aria-label={`Clarity score ${clarityScore} percent`}
              >
                {clarityScore}%
              </span>
              <span
                className="font-mono font-semibold text-4xl stat-card"
                style={{ color: GRADE_COLOR[clarityGrade] ?? 'var(--text-active)' }}
                aria-label={`Grade ${clarityGrade}`}
              >
                {clarityGrade}
              </span>
            </div>
            <p className="text-xs font-mono" style={{ color: 'var(--text-stats)' }}>
              {promptType} · {duration}s
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" id="btn-retry" onClick={onRetry} className="pill-btn active px-4 py-2">
                retry
              </button>
              <button type="button" id="btn-next" onClick={onNext} className="pill-btn px-4 py-2">
                next test
              </button>
              <button type="button" id="btn-share" onClick={handleShare} className="pill-btn px-4 py-2">
                share
              </button>
            </div>
            <p className="text-xs font-mono" style={{ color: 'var(--text-stats)' }}>
              tab · retry &nbsp;&nbsp; enter · next
            </p>
          </div>
        </div>
      ) : null}
    </motion.div>
  )
}
