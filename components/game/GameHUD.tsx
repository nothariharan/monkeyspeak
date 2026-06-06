'use client'

interface GameHUDProps {
  wpm: number
  timeRemainingMs: number
  momentum: number
}

function formatTime(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function GameHUD({ wpm, timeRemainingMs, momentum }: GameHUDProps) {
  return (
    <header className="game-hud" role="status" aria-live="polite" aria-label="Live test statistics">
      <div className="game-hud-stat">
        <span className="game-hud-label">WPM</span>
        <span className="game-hud-value tabular-nums">{wpm}</span>
      </div>
      <div className="game-hud-stat game-hud-stat--center">
        <span className="game-hud-label">TIME</span>
        <span className="game-hud-value tabular-nums">{formatTime(timeRemainingMs)}</span>
      </div>
      <div className="game-hud-stat game-hud-stat--right">
        <span className="game-hud-label">MOMENTUM</span>
        <span className="game-hud-value tabular-nums">{momentum}</span>
      </div>
    </header>
  )
}
