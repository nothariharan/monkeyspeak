'use client'

import { useMemo, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { generateShareCard } from '@/lib/shareCard'
import SparklineChart from '@/components/SparklineChart'
import type { DiffWord, WordResult, WpmSnapshot } from '@/store/testStore'

type SpeedReviewItem = {
  word: string
  tag: 'correct' | 'substituted' | 'missed'
  spoken?: string
}

type SpeedRecognizedItem = {
  display: string
  tag: 'correct' | 'substituted' | 'missed'
  title?: string
}

interface ResultsPanelProps {
  mode: 'speed' | 'clarity'
  wpm: number
  rawWpm?: number
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
  /** Speed: WPM sparkline x-axis; falls back to testStartedAt */
  speedClockStartedAt?: number | null
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

const SPEED_TAG_CLASS: Record<SpeedReviewItem['tag'] | 'added', string> = {
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

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--text-stats)' }}>
        {label}
      </span>
      <span className="font-mono text-xl" style={{ color: 'var(--text-active)' }}>
        {value}
      </span>
    </div>
  )
}

function StatRowItem({ label, value, colorVar }: { label: string; value: number; colorVar: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm font-mono">
      <span style={{ color: 'var(--text-stats)' }}>{label}</span>
      <span style={{ color: colorVar }}>{value}</span>
    </div>
  )
}

export default function ResultsPanel({
  mode,
  wpm,
  rawWpm = 0,
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
  speedClockStartedAt = null,
  clarityScore,
  clarityGrade,
  diffResult,
  isPersonalBest = false,
  personalBestWpm,
  onRetry,
  onNext,
  onPractice,
}: ResultsPanelProps) {
  /** Expected prompt words + counts (unchanged semantics). */
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

  /** Per prompt index: what ASR stored (gap placeholder if none). */
  const speedRecognizedReview = useMemo(() => {
    if (mode !== 'speed') return null
    const items: SpeedRecognizedItem[] = []
    for (let i = 0; i < prompt.length; i++) {
      const pw = prompt[i] ?? ''
      const r = confirmedWords[i]
      if (!r) {
        items.push({
          display: '—',
          tag: 'missed',
          title: `expected “${pw}” · not captured`,
        })
      } else if (r.isCorrect) {
        items.push({ display: r.word, tag: 'correct', title: pw !== r.word ? `expected “${pw}”` : undefined })
      } else {
        items.push({
          display: r.word,
          tag: 'substituted',
          title: `expected “${pw}”`,
        })
      }
    }
    return { items, extraWords: confirmedWords.slice(prompt.length) }
  }, [mode, prompt, confirmedWords])

  const consistencyDisplay = Number.isFinite(consistency) ? `${consistency}%` : '—'

  const handleShare = () => {
    generateShareCard(
      mode === 'speed'
        ? { mode: 'speed', wpm, consistency, fillerCount, duration, promptType }
        : { mode: 'clarity', clarityScore, clarityGrade }
    )
  }

  const sectionLabelStyle: CSSProperties = { color: 'var(--text-stats)' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto"
      style={{
        padding: 'clamp(1rem, 4vw, 2.5rem)',
        background: 'var(--bg)',
      }}
      role="dialog"
      aria-label="Test results"
    >
      <div
        className={`grid w-full max-w-[1200px] py-8 md:py-10 items-start gap-10 md:gap-12 lg:gap-14 ${
          mode === 'speed'
            ? 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(280px,0.9fr)]'
            : 'grid-cols-1 md:grid-cols-2'
        }`}
      >
        {mode === 'speed' ? (
          <>
            <div className="min-w-0">
              <p className="text-xs font-mono uppercase tracking-widest mb-4" style={sectionLabelStyle}>
                prompt review
              </p>
              <div className="leading-loose rounded p-4 mb-6 max-h-[min(40vh,28rem)] overflow-y-auto" style={reviewBoxStyle}>
                {speedPromptReview?.items.map((w, i) => (
                  <span
                    key={i}
                    className={`inline-block mr-[0.35em] ${SPEED_TAG_CLASS[w.tag]}`}
                    title={
                      w.tag === 'substituted' && w.spoken
                        ? `you said “${w.spoken}”`
                        : w.tag === 'missed'
                          ? 'not captured in time'
                          : w.tag
                    }
                  >
                    {w.word}
                  </span>
                ))}
                {speedPromptReview && speedPromptReview.extraWords.length > 0 ? (
                  <span
                    className="block mt-3 pt-3 font-mono text-sm"
                    style={{
                      borderTop: '1px solid color-mix(in srgb, var(--text-muted) 45%, transparent)',
                    }}
                  >
                    <span className="block mb-1 uppercase tracking-wider text-xs" style={sectionLabelStyle}>
                      extra
                    </span>
                    {speedPromptReview.extraWords.map((x, j) => (
                      <span key={`x-${j}`} className={`inline-block mr-[0.35em] ${SPEED_TAG_CLASS.added}`} title="not in prompt">
                        {x.word}
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 mb-6 font-mono text-sm">
                <StatRowItem label="correct" value={speedPromptReview?.counts.correct ?? 0} colorVar="var(--accent)" />
                <StatRowItem label="missed" value={speedPromptReview?.counts.missed ?? 0} colorVar="var(--text-stats)" />
                <StatRowItem
                  label="substituted"
                  value={speedPromptReview?.counts.substituted ?? 0}
                  colorVar="var(--error)"
                />
                <StatRowItem label="extra" value={speedPromptReview?.counts.extra ?? 0} colorVar="var(--orange)" />
              </div>
              <div className="text-xs font-mono space-y-1" style={{ color: 'var(--text-stats)' }}>
                <div>
                  <span className="diff-correct">■</span> correct
                </div>
                <div>
                  <span className="diff-substituted">■</span> wrong word
                </div>
                <div>
                  <span className="diff-missed">■</span> missed
                </div>
                <div>
                  <span className="diff-added">■</span> extra
                </div>
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-xs font-mono uppercase tracking-widest mb-4" style={sectionLabelStyle}>
                recognized
              </p>
              <div className="leading-loose rounded p-4 mb-6 max-h-[min(40vh,28rem)] overflow-y-auto" style={reviewBoxStyle}>
                {speedRecognizedReview?.items.map((w, i) => (
                  <span key={i} className={`inline-block mr-[0.35em] ${SPEED_TAG_CLASS[w.tag]}`} title={w.title}>
                    {w.display}
                  </span>
                ))}
                {speedRecognizedReview && speedRecognizedReview.extraWords.length > 0 ? (
                  <span
                    className="block mt-3 pt-3 font-mono text-sm"
                    style={{
                      borderTop: '1px solid color-mix(in srgb, var(--text-muted) 45%, transparent)',
                    }}
                  >
                    <span className="block mb-1 uppercase tracking-wider text-xs" style={sectionLabelStyle}>
                      extra
                    </span>
                    {speedRecognizedReview.extraWords.map((x, j) => (
                      <span key={`rx-${j}`} className={`inline-block mr-[0.35em] ${SPEED_TAG_CLASS.added}`} title="not in prompt">
                        {x.word}
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="min-w-0 flex flex-col gap-8">
              <div>
                <div className="flex items-end gap-3">
                  <span
                    className="font-mono font-semibold"
                    style={{ fontSize: '3.5rem', color: 'var(--accent)', lineHeight: 1 }}
                    aria-label={`${wpm} words per minute`}
                  >
                    {wpm}
                  </span>
                  {isPersonalBest && (
                    <span
                      title="Personal best!"
                      style={{ color: 'var(--accent)', marginBottom: '0.35rem' }}
                      aria-label="Personal best"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2 3h10v-2H7v2z"/>
                      </svg>
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-sm font-mono" style={{ color: 'var(--text-stats)' }}>
                    wpm
                  </span>
                  {isPersonalBest && (
                    <span className="text-xs font-mono" style={{ color: 'var(--accent)' }}>
                      new personal best!
                    </span>
                  )}
                  {!isPersonalBest && personalBestWpm != null && personalBestWpm > 0 && (
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      best {personalBestWpm}
                    </span>
                  )}
                </div>
              </div>

              {/* Accuracy */}
              {(() => {
                const attempted = Math.min(confirmedWords.length, prompt.length)
                const correct = confirmedWords.slice(0, attempted).filter((w) => w.isCorrect).length
                const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0
                return (
                  <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <StatCell label="words spoken" value={wordCount} />
                    <StatCell label="fillers removed" value={fillerCount} />
                    <StatCell label="peak wpm" value={peakWpm} />
                    <StatCell label="consistency" value={consistencyDisplay} />
                    <StatCell label="accuracy" value={`${accuracy}%`} />
                    {rawWpm > 0 && <StatCell label="raw wpm" value={rawWpm} />}
                  </div>
                )
              })()}

              <div>
                <SparklineChart
                  wpmSnapshots={wpmSnapshots}
                  testStartedAt={mode === 'speed' ? speedClockStartedAt ?? testStartedAt : testStartedAt}
                  height={110}
                />
                <p className="text-xs font-mono mt-2 uppercase tracking-wider" style={{ color: 'var(--text-stats)' }}>
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
                {onPractice && (speedPromptReview?.counts.missed ?? 0) + (speedPromptReview?.counts.substituted ?? 0) > 0 && (
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
          </>
        ) : (
          <>
            <div className="min-w-0">
              <p className="text-xs font-mono uppercase tracking-widest mb-4" style={sectionLabelStyle}>
                transcript diff
              </p>
              <div
                className="leading-loose rounded p-4 mb-6 max-h-[min(28rem,50vh)] overflow-y-auto"
                style={{
                  ...reviewBoxStyle,
                  fontSize: '0.95rem',
                  lineHeight: '2rem',
                }}
              >
                {diffResult.map((w, i) => (
                  <span
                    key={i}
                    className={`inline-block mr-[0.4em] ${TAG_CLASS[w.tag]}`}
                    title={w.tag === 'substituted' ? `expected: ${w.expected}` : w.tag}
                  >
                    {w.word}
                  </span>
                ))}
              </div>
              <div className="text-xs font-mono flex flex-wrap gap-4" style={{ color: 'var(--text-stats)' }}>
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
                  style={{ fontSize: '3.5rem', color: 'var(--accent)', lineHeight: 1 }}
                  aria-label={`Clarity score ${clarityScore} percent`}
                >
                  {clarityScore}%
                </span>
                <span
                  className="font-mono font-semibold text-4xl"
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
          </>
        )}
      </div>
    </motion.div>
  )
}
