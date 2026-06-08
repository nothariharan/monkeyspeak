'use client'

interface TimeProgressBarProps {
  timeRemainingMs: number
  totalDurationMs: number
}

function formatTime(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function getTimeColor(percentRemaining: number): string {
  if (percentRemaining > 0.5) return 'var(--success)'
  if (percentRemaining > 0.2) return '#eab308'
  return 'var(--error)'
}

export default function TimeProgressBar({
  timeRemainingMs,
  totalDurationMs,
}: TimeProgressBarProps) {
  const percent =
    totalDurationMs > 0
      ? Math.max(0, Math.min(100, (timeRemainingMs / totalDurationMs) * 100))
      : 0
  const color = getTimeColor(percent / 100)

  return (
    <div className="time-progress">
      <div className="time-progress-header">
        <span className="time-progress-label">TIME</span>
        <span className="time-progress-clock tabular-nums">{formatTime(timeRemainingMs)}</span>
      </div>
      <div
        className="time-progress-track"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Time remaining ${formatTime(timeRemainingMs)}`}
      >
        <div
          className="time-progress-fill"
          style={{
            width: `${percent}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  )
}
