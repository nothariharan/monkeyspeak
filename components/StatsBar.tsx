'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

interface StatsBarProps {
  wordCount: number
  timeRemainingMs: number
  isWarning: boolean
  micState: 'idle' | 'requesting' | 'active' | 'denied' | 'error'
  mode: 'speed' | 'clarity'
  wpm?: number
  accuracy?: number
  totalWords?: number
}

function formatTime(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function StatCard({
  label,
  value,
  icon,
  iconBg,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  iconBg: string
}) {
  return (
    <div className="clean-card-sm flex items-center gap-3 px-4 py-3 min-w-[140px] stat-card">
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          width: 36,
          height: 36,
          background: iconBg,
          border: '2px solid var(--border)',
        }}
      >
        {icon}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="stat-value tabular-nums">{value}</span>
        <span className="stat-label">{label}</span>
      </div>
    </div>
  )
}

export default function StatsBar({
  wordCount,
  timeRemainingMs,
  isWarning,
  micState,
  mode,
  wpm = 0,
  accuracy = 0,
  totalWords = 0,
}: StatsBarProps) {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!barRef.current) return
    const ctx = gsap.context(() => {
      gsap.from('.stat-card', {
        opacity: 0,
        y: 16,
        stagger: 0.08,
        duration: 0.4,
        ease: 'power2.out',
      })
    }, barRef)
    return () => ctx.revert()
  }, [])

  const elapsed = mode === 'speed' ? formatTime(timeRemainingMs) : '—'
  const wordsLabel = totalWords > 0 ? `${wordCount}/${totalWords}` : String(wordCount)

  return (
    <div
      ref={barRef}
      className="flex flex-wrap items-center justify-center gap-3 py-4 px-6 select-none"
      role="status"
      aria-live="polite"
      aria-label="Live test statistics"
    >
      {mode === 'speed' && (
        <StatCard
          label="WPM"
          value={wpm}
          iconBg="color-mix(in srgb, var(--accent) 20%, var(--surface))"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />
      )}

      <StatCard
        label="accuracy"
        value={accuracy > 0 ? `${accuracy}%` : '—'}
        iconBg="color-mix(in srgb, var(--success) 20%, var(--surface))"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        }
      />

      <StatCard
        label="time"
        value={elapsed}
        iconBg="color-mix(in srgb, #eab308 25%, var(--surface))"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2.5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        }
      />

      <StatCard
        label={mode === 'clarity' ? 'typed' : 'words'}
        value={wordsLabel}
        iconBg="color-mix(in srgb, #8b5cf6 20%, var(--surface))"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        }
      />

      {/* Mic status */}
      <div className="flex items-center gap-2 ml-2">
        {micState === 'active' && <span className="live-dot" aria-label="Microphone active" />}
        {(micState === 'denied' || micState === 'error') && (
          <span
            className="inline-block w-3 h-3"
            style={{
              background: 'var(--error)',
              border: '2px solid var(--border)',
              animation: 'dot-pulse 1s ease-in-out infinite',
            }}
            aria-label="Microphone error"
          />
        )}
        {micState === 'requesting' && (
          <span
            className="inline-block w-3 h-3"
            style={{
              background: 'var(--text-stats)',
              border: '2px solid var(--border)',
              animation: 'dot-pulse 1s ease-in-out infinite',
            }}
            aria-label="Requesting microphone"
          />
        )}
        {isWarning && mode === 'speed' && (
          <span className="font-mono text-xs font-bold uppercase" style={{ color: 'var(--error)' }}>
            hurry!
          </span>
        )}
      </div>
    </div>
  )
}
