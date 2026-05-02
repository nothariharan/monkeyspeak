'use client'

import { useMemo, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { generateShareCard } from '@/lib/shareCard'
import { diffWords } from '@/lib/diff'
import SparklineChart from '@/components/SparklineChart'
import type { DiffWord, WordResult, WpmSnapshot } from '@/store/testStore'

type SpeedReviewItem = {
  word: string
  tag: 'correct' | 'substituted' | 'missed'
  spoken?: string
}

interface ResultsPanelProps {
  mode: 'speed' | 'clarity'
  wpm: number
  wordCount: number
  fillerCount: number
  peakWpm: number
  consistency: number
  duration: number
  promptType: string
  prompt?: string[]
  confirmedWords?: WordResult[]
  wpmSnapshots?: WpmSnapshot[]
  testStartedAt?: number | null
  clarityScore: number
  clarityGrade: 'S' | 'A' | 'B' | 'C' | 'needs work'
  diffResult: DiffWord[]
  onRetry: () => void
  onNext: () => void
}

const GRADE_COLOR: Record<string, string> = {
  S: '#e8c96a',
  A: '#6ae8a8',
  B: '#6ab0e8',
  C: '#f09050',
  'needs work': '#ca4754',
}

const ACCENT = '#7eb8f7'
const ERR = '#ca4754'
const EXTRA = '#e8a87c'
const MUTED = '#2e2e38'

function diffWordStyle(tag: DiffWord['tag']): CSSProperties {
  switch (tag) {
    case 'correct':
      return { color: ACCENT }
    case 'substituted':
      return { color: ERR, textDecoration: 'underline' }
    case 'missed':
      return { color: ERR, opacity: 0.4, textDecoration: 'line-through' }
    case 'added':
      return { color: EXTRA, textDecoration: 'underline' }
    default:
      return {}
  }
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-mono uppercase tracking-wider" style={{ color: MUTED }}>
        {label}
      </span>
      <span className="font-mono text-xl" style={{ color: '#e8e8ec' }}>
        {value}
      </span>
    </div>
  )
}

function StatRowItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm font-mono">
      <span style={{ color: MUTED }}>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  )
}

export default function ResultsPanel({
  mode,
  wpm,
  wordCount,
  fillerCount,
  peakWpm,
  consistency,
  duration,
  promptType,
  prompt = [],
  confirmedWords = [],
  wpmSnapshots = [],
  testStartedAt = null,
  clarityScore,
  clarityGrade,
  diffResult,
  onRetry,
  onNext,
}: ResultsPanelProps) {
  /** Align each prompt word to the same index in `confirmedWords` — show expected text, colour-only (no ASR string substitution). */
  const speedPromptReview = useMemo(() => {
    if (mode !== 'speed') return null
    const items: SpeedReviewItem[] = []
    let correct = 0
    let missed = 0
    let substituted = 0
    for (let i = 0; i < prompt.length; i++) {
      const pw = prompt[i] ?? ''
      const r = confirmedWords[i]
      if (!r) {
        missed++
        items.push({ word: pw, tag: 'missed' })
      } else if (r.isCorrect) {
        correct++
        items.push({ word: pw, tag: 'correct' })
      } else {
        substituted++
        items.push({ word: pw, tag: 'substituted', spoken: r.word })
      }
    }
    const extraWords = confirmedWords.slice(prompt.length)
    const extra = extraWords.length
    return { items, extraWords, counts: { correct, missed, substituted, extra } }
  }, [mode, prompt, confirmedWords])

  const consistencyDisplay = Number.isFinite(consistency) ? `${consistency}%` : '—'

  const handleShare = () => {
    generateShareCard(
      mode === 'speed'
        ? { mode: 'speed', wpm, consistency, fillerCount, duration, promptType }
        : { mode: 'clarity', clarityScore, clarityGrade }
    )
  }

  const TAG_CLASS: Record<DiffWord['tag'], string> = {
    correct: 'diff-correct',
    substituted: 'diff-substituted',
    missed: 'diff-missed',
    added: 'diff-added',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto"
      style={{
        padding: 'clamp(1rem, 4vw, 2.5rem)',
        background: '#0e0e10',
      }}
      role="dialog"
      aria-label="Test results"
    >
      <div className="grid w-full max-w-[1100px] gap-10 md:gap-16 lg:gap-20 py-8 md:py-10 items-start grid-cols-1 md:grid-cols-2">
        {mode === 'speed' ? (
          <>
            <div className="min-w-0">
              <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: MUTED }}>
                prompt review
              </p>
              <div
                className="leading-loose rounded p-4 mb-6 max-h-[min(40vh,28rem)] overflow-y-auto"
                style={{
                  border: `1px solid ${MUTED}`,
                  fontSize: 'var(--test-font-size, 1.05rem)',
                  lineHeight: 'var(--test-line-height, 1.75)',
                }}
              >
                {speedPromptReview?.items.map((w, i) => (
                  <span
                    key={i}
                    className="inline-block mr-[0.35em]"
                    style={diffWordStyle(w.tag)}
                    title={
                      w.tag === 'substituted' && w.spoken
                        ? `you said “${w.spoken}”`
                        : w.tag
                    }
                  >
                    {w.word}
                  </span>
                ))}
                {speedPromptReview && speedPromptReview.extraWords.length > 0 ? (
                  <span className="block mt-3 pt-3 font-mono text-sm" style={{ borderTop: `1px solid ${MUTED}` }}>
                    <span className="block mb-1 uppercase tracking-wider text-xs" style={{ color: MUTED }}>
                      extra
                    </span>
                    {speedPromptReview.extraWords.map((x, j) => (
                      <span
                        key={`x-${j}`}
                        className="inline-block mr-[0.35em]"
                        style={diffWordStyle('added')}
                        title="not in prompt"
                      >
                        {x.word}
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 mb-6 font-mono text-sm">
                <StatRowItem label="correct" value={speedPromptReview?.counts.correct ?? 0} color={ACCENT} />
                <StatRowItem label="missed" value={speedPromptReview?.counts.missed ?? 0} color={ERR} />
                <StatRowItem label="substituted" value={speedPromptReview?.counts.substituted ?? 0} color={ERR} />
                <StatRowItem label="extra" value={speedPromptReview?.counts.extra ?? 0} color={EXTRA} />
              </div>
              <div className="text-xs font-mono space-y-1" style={{ color: MUTED }}>
                <div>
                  <span style={{ color: ACCENT }}>■</span> correct
                </div>
                <div>
                  <span style={{ color: ERR }}>■</span> wrong word
                </div>
                <div>
                  <span style={{ color: ERR, textDecoration: 'line-through' }}>■</span> missed
                </div>
                <div>
                  <span style={{ color: EXTRA }}>■</span> extra
                </div>
              </div>
            </div>

            <div className="min-w-0 flex flex-col gap-8">
              <div>
                <span
                  className="font-mono font-semibold block"
                  style={{ fontSize: '3.5rem', color: ACCENT, lineHeight: 1 }}
                  aria-label={`${wpm} words per minute`}
                >
                  {wpm}
                </span>
                <span className="text-sm font-mono" style={{ color: MUTED }}>
                  wpm
                </span>
              </div>

              <div
                className="grid gap-6"
                style={{ gridTemplateColumns: '1fr 1fr' }}
              >
                <StatCell label="words spoken" value={wordCount} />
                <StatCell label="fillers removed" value={fillerCount} />
                <StatCell label="peak wpm" value={peakWpm} />
                <StatCell label="consistency" value={consistencyDisplay} />
              </div>

              <div>
                <SparklineChart wpmSnapshots={wpmSnapshots} testStartedAt={testStartedAt} height={110} />
                <p className="text-xs font-mono mt-2 uppercase tracking-wider" style={{ color: MUTED }}>
                  wpm over time
                </p>
              </div>

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
              <p className="text-xs font-mono" style={{ color: MUTED }}>
                tab · retry &nbsp;&nbsp; enter · next
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="min-w-0">
              <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: MUTED }}>
                transcript diff
              </p>
              <div
                className="leading-loose rounded p-4 mb-6 max-h-[min(28rem,50vh)] overflow-y-auto"
                style={{
                  border: `1px solid ${MUTED}`,
                  fontSize: '0.95rem',
                  lineHeight: '2rem',
                }}
              >
                {diffResult.map((w, i) => (
                  <span key={i} className={`inline-block mr-[0.4em] ${TAG_CLASS[w.tag]}`} title={w.tag === 'substituted' ? `expected: ${w.expected}` : w.tag}>
                    {w.word}
                  </span>
                ))}
              </div>
              <div className="text-xs font-mono flex flex-wrap gap-4" style={{ color: MUTED }}>
                <span>
                  <span className="diff-correct">■</span> correct
                </span>
                <span>
                  <span className="diff-substituted">■</span> wrong word
                </span>
                <span>
                  <span className="diff-missed">■</span> missed
                </span>
                <span>
                  <span className="diff-added">■</span> extra
                </span>
              </div>
            </div>

            <div className="min-w-0 flex flex-col gap-8">
              <div className="flex items-baseline gap-4 flex-wrap">
                <span
                  className="font-mono font-semibold"
                  style={{ fontSize: '3.5rem', color: ACCENT, lineHeight: 1 }}
                  aria-label={`Clarity score ${clarityScore} percent`}
                >
                  {clarityScore}%
                </span>
                <span
                  className="font-mono font-semibold text-4xl"
                  style={{ color: GRADE_COLOR[clarityGrade] ?? '#e8e8ec' }}
                  aria-label={`Grade ${clarityGrade}`}
                >
                  {clarityGrade}
                </span>
              </div>
              <p className="text-xs font-mono" style={{ color: MUTED }}>
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
              <p className="text-xs font-mono" style={{ color: MUTED }}>
                tab · retry &nbsp;&nbsp; enter · next
              </p>
            </div>
          </>
        )}
      </div>
    </motion.div>
  )
}
