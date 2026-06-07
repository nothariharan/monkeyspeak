'use client'

import MomentumFire from '@/components/game/MomentumFire'

interface GameHUDProps {
  timeRemainingMs: number
  momentum: number
}

function formatTime(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function GameHUD({ timeRemainingMs, momentum }: GameHUDProps) {
  return (
    <header className="game-hud" role="status" aria-live="polite" aria-label="Live test statistics">
      <div className="game-hud-spacer" aria-hidden />
      <div className="game-hud-stat game-hud-stat--center">
        <span className="game-hud-label">TIME</span>
        <span className="game-hud-value tabular-nums">{formatTime(timeRemainingMs)}</span>
      </div>
      <MomentumFire momentum={momentum} />
    </header>
  )
}
