'use client'

import { motion } from 'framer-motion'
import { generateShareCard } from '@/lib/shareCard'
import type { DiffWord } from '@/store/testStore'

interface ResultsPanelProps {
  mode: 'speed' | 'clarity'
  // Speed mode stats
  wpm: number
  wordCount: number
  fillerCount: number
  peakWpm: number
  consistency: number
  duration: number
  promptType: string
  // Clarity mode stats
  clarityScore: number
  clarityGrade: 'S' | 'A' | 'B' | 'C' | 'needs work'
  diffResult: DiffWord[]
  // Actions
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
  correct:     'diff-correct',
  substituted: 'diff-substituted',
  missed:      'diff-missed',
  added:       'diff-added',
}

export default function ResultsPanel({
  mode,
  wpm, wordCount, fillerCount, peakWpm, consistency, duration, promptType,
  clarityScore, clarityGrade, diffResult,
  onRetry, onNext,
}: ResultsPanelProps) {

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
      className="w-full max-w-2xl mt-8 pt-6"
      style={{ borderTop: '1px solid var(--text-muted)', opacity: 0.9 }}
      role="region"
      aria-label="Test results"
    >
      {mode === 'speed' ? (
        <>
          {/* Big WPM number */}
          <div className="text-center mb-6">
            <span
              className="font-mono font-semibold"
              style={{ fontSize: '4rem', color: 'var(--accent)', lineHeight: 1 }}
              aria-label={`${wpm} words per minute`}
            >
              {wpm}
            </span>
            <span className="ml-2 text-xl" style={{ color: 'var(--text-stats)' }}>wpm</span>
          </div>

          {/* Secondary stats grid */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'words spoken', value: wordCount },
              { label: 'fillers removed', value: fillerCount },
              { label: 'peak wpm', value: peakWpm },
              { label: 'consistency', value: `${consistency}%` },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <span className="stat-value text-2xl">{value}</span>
                <span className="stat-label text-center">{label}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Clarity score */}
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

          {/* Diff recap */}
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
              <span
                key={i}
                className={`inline-block mr-[0.4em] ${TAG_CLASS[w.tag]}`}
                title={w.tag === 'substituted' ? `expected: ${w.expected}` : w.tag}
              >
                {w.word}
              </span>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mb-4 text-xs" style={{ color: 'var(--text-stats)' }}>
            <span><span className="diff-correct">■</span> correct</span>
            <span><span className="diff-substituted">■</span> wrong word</span>
            <span><span className="diff-missed">■</span> missed</span>
            <span><span className="diff-added">■</span> extra</span>
          </div>
        </>
      )}

      <hr className="results-divider" />

      {/* Action buttons */}
      <div className="flex items-center gap-3 mt-2">
        <button id="btn-retry"   onClick={onRetry}   className="pill-btn active px-4 py-2">retry</button>
        <button id="btn-next"    onClick={onNext}     className="pill-btn px-4 py-2">next test</button>
        <button id="btn-share"   onClick={handleShare} className="pill-btn px-4 py-2">share</button>
      </div>
    </motion.div>
  )
}
