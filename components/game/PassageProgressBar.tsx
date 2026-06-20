'use client'

// passage mode hud — elapsed clock + words dissolved count (no countdown timer)

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

interface PassageProgressBarProps {
  elapsedMs: number
  currentIndex: number
  totalWords: number
}

export default function PassageProgressBar({ elapsedMs, currentIndex, totalWords }: PassageProgressBarProps) {
  const percent = totalWords > 0
    ? Math.max(0, Math.min(100, (currentIndex / totalWords) * 100))
    : 0

  return (
    <div className="time-progress">
      <div className="time-progress-header">
        <span className="time-progress-label">WORDS</span>
        <span className="time-progress-clock tabular-nums">
          {currentIndex}/{totalWords}
          <span style={{ color: 'var(--text-stats)', fontSize: '0.7em', marginLeft: '0.4rem' }}>
            {formatElapsed(elapsedMs)}
          </span>
        </span>
      </div>
      <div
        className="time-progress-track"
        role="progressbar"
        aria-valuenow={currentIndex}
        aria-valuemin={0}
        aria-valuemax={totalWords}
        aria-label={`${currentIndex} of ${totalWords} words spoken`}
      >
        <div
          className="time-progress-fill"
          style={{
            width: `${percent}%`,
            backgroundColor: percent > 80 ? 'var(--success)' : 'var(--accent)',
            transition: 'width 0.15s ease',
          }}
        />
      </div>
    </div>
  )
}
