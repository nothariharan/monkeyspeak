'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { generateShareCard } from '@/lib/shareCard'
import SpeedWpmGraph from '@/components/SpeedWpmGraph'
import type { DiffWord, WordResult, WpmSnapshot, SpeedTimelineEvent } from '@/store/testStore'

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
  speedTimelineEvents?: SpeedTimelineEvent[]
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

const TAG_CLASS: Record<DiffWord['tag'], string> = {
  correct: 'diff-correct',
  substituted: 'diff-substituted',
  missed: 'diff-missed',
  added: 'diff-added',
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
  speedTimelineEvents = [],
  clarityScore,
  clarityGrade,
  diffResult,
  onRetry,
  onNext,
}: ResultsPanelProps) {
  const accuracyPct = useMemo(() => {
    if (confirmedWords.length === 0) return 100
    const ok = confirmedWords.filter((w) => w.isCorrect).length
    return Math.round((100 * ok) / confirmedWords.length)
  }, [confirmedWords])

  const handleShare = () => {
    generateShareCard(
      mode === 'speed'
        ? { mode: 'speed', wpm, consistency, fillerCount, duration, promptType }
        : { mode: 'clarity', clarityScore, clarityGrade }
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-full max-w-5xl mt-8 pt-6 px-1"
      style={{ borderTop: '1px solid var(--text-muted)', opacity: 0.95 }}
      role="region"
      aria-label="Test results"
    >
      {mode === 'speed' ? (
        <>
          <div className="flex flex-wrap items-end justify-center gap-6 mb-8">
            <div className="text-center">
              <span
                className="font-mono font-semibold block"
                style={{ fontSize: '3.5rem', color: 'var(--accent)', lineHeight: 1 }}
                aria-label={`${wpm} words per minute`}
              >
                {wpm}
              </span>
              <span className="text-sm" style={{ color: 'var(--text-stats)' }}>
                wpm
              </span>
            </div>
            <div className="text-center">
              <span
                className="font-mono font-semibold block"
                style={{ fontSize: '3.5rem', color: 'var(--accent)', lineHeight: 1 }}
                aria-label={`Accuracy ${accuracyPct} percent`}
              >
                {accuracyPct}
                <span className="text-2xl">%</span>
              </span>
              <span className="text-sm" style={{ color: 'var(--text-stats)' }}>
                acc
              </span>
            </div>
            <div className="text-center text-xs font-mono" style={{ color: 'var(--text-stats)' }}>
              <div>
                {promptType} · {duration}s
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 mb-8">
            <div>
              <h3 className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: 'var(--text-stats)' }}>
                recap
              </h3>
              <div
                className="leading-loose rounded p-4 max-h-[min(22rem,50vh)] overflow-y-auto"
                style={{
                  border: '1px solid var(--text-muted)',
                  fontSize: 'var(--test-font-size)',
                  lineHeight: 'var(--test-line-height)',
                }}
                aria-label="Word by word results"
              >
                {prompt.map((expected, i) => {
                  const got = confirmedWords[i]
                  if (!got) {
                    return (
                      <span key={`${expected}-${i}`} className="word unspoken inline-block mr-[0.35em]">
                        {expected}
                      </span>
                    )
                  }
                  const state = got.isCorrect ? 'correct' : 'error'
                  const title = got.isCorrect
                    ? undefined
                    : `expected “${expected}” · spoke “${got.word}”`
                  return (
                    <span
                      key={`${expected}-${i}`}
                      className={`word ${state} inline-block mr-[0.35em]`}
                      title={title}
                    >
                      {expected}
                      {!got.isCorrect ? (
                        <span className="text-xs opacity-80" style={{ color: 'var(--error)' }}>
                          {' '}
                          ({got.word})
                        </span>
                      ) : null}
                    </span>
                  )
                })}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: 'var(--text-stats)' }}>
                session
              </h3>
              <div className="rounded p-2" style={{ border: '1px solid var(--text-muted)' }}>
                <SpeedWpmGraph
                  durationSec={duration}
                  testStartedAt={testStartedAt}
                  wpmSnapshots={wpmSnapshots}
                  speedTimelineEvents={speedTimelineEvents}
                  peakWpm={peakWpm}
                  currentWpm={wpm}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'words', value: wordCount },
              { label: 'fillers', value: fillerCount },
              { label: 'peak wpm', value: peakWpm },
              { label: 'consistency', value: `${consistency}%` },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <span className="stat-value text-xl">{value}</span>
                <span className="stat-label text-center">{label}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-4 mb-4">
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

          <div
            className="p-4 rounded mb-4 leading-loose"
            style={{
              border: '1px solid var(--text-muted)',
              fontSize: '0.9rem',
              lineHeight: '2rem',
              maxHeight: '12rem',
              overflowY: 'auto',
            }}
            aria-label="Diff result"
          >
            {diffResult.map((w, i) => (
              <span key={i} className={`inline-block mr-[0.4em] ${TAG_CLASS[w.tag]}`} title={w.tag === 'substituted' ? `expected: ${w.expected}` : w.tag}>
                {w.word}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-4 mb-4 text-xs" style={{ color: 'var(--text-stats)' }}>
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
        </>
      )}

      <hr className="results-divider" />

      <div className="flex items-center gap-3 mt-2 flex-wrap">
        <button id="btn-retry" type="button" onClick={onRetry} className="pill-btn active px-4 py-2">
          retry
        </button>
        <button id="btn-next" type="button" onClick={onNext} className="pill-btn px-4 py-2">
          next test
        </button>
        <button id="btn-share" type="button" onClick={handleShare} className="pill-btn px-4 py-2">
          share
        </button>
      </div>
    </motion.div>
  )
}
