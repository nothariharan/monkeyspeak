'use client'

import { motion } from 'framer-motion'

interface StatsBarProps {
  wordCount: number
  timeRemainingMs: number
  isWarning: boolean
  micState: 'idle' | 'requesting' | 'active' | 'denied' | 'error'
  mode: 'speed' | 'clarity'
}

function formatTime(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function StatsBar({
  wordCount,
  timeRemainingMs,
  isWarning,
  micState,
  mode,
}: StatsBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex items-center justify-center gap-8 py-3 select-none"
      role="status"
      aria-live="polite"
      aria-label="Live test statistics"
    >
      {/* Word count */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="stat-value">{wordCount}</span>
        <span className="stat-label">{mode === 'clarity' ? 'typed' : 'words'}</span>
      </div>

      {/* Timer — Speed mode */}
      {mode === 'speed' && (
        <div className="flex flex-col items-center gap-0.5">
          <span
            className="stat-value tabular-nums"
            style={{ color: isWarning ? 'var(--error)' : undefined, transition: 'color 0.3s' }}
          >
            {formatTime(timeRemainingMs)}
          </span>
          <span className="stat-label">time</span>
        </div>
      )}

      {/* Mic status indicator */}
      <div className="flex items-center gap-2 ml-4">
        {micState === 'active' && (
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: 'var(--accent)' }} />
            <span className="relative inline-flex rounded-full h-3 w-3"
              style={{ background: 'var(--accent)' }} />
          </div>
        )}
        {(micState === 'denied' || micState === 'error') && (
          <div className="relative group cursor-default">
            <span
              className="inline-flex h-3 w-3 rounded-full"
              style={{
                background: 'var(--error)',
                animation: 'dot-pulse 1s ease-in-out infinite',
              }}
            />
            <span className="absolute left-1/2 -translate-x-1/2 bottom-5 text-xs whitespace-nowrap px-2 py-1 rounded
              opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-active)', border: '1px solid var(--text-muted)' }}
            >
              microphone access needed
            </span>
          </div>
        )}
        {micState === 'requesting' && (
          <span
            className="inline-flex h-3 w-3 rounded-full"
            style={{ background: 'var(--text-stats)', animation: 'dot-pulse 1s ease-in-out infinite' }}
          />
        )}
      </div>
    </motion.div>
  )
}
