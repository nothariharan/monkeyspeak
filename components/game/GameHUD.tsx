'use client'

import MomentumFire from '@/components/game/MomentumFire'
import TimeProgressBar from '@/components/game/TimeProgressBar'

interface GameHUDProps {
  timeRemainingMs: number
  totalDurationMs: number
  momentum: number
}

export default function GameHUD({
  timeRemainingMs,
  totalDurationMs,
  momentum,
}: GameHUDProps) {
  return (
    <header className="game-header-row" role="status" aria-live="polite" aria-label="Live test statistics">
      <TimeProgressBar
        timeRemainingMs={timeRemainingMs}
        totalDurationMs={totalDurationMs}
      />
      <MomentumFire momentum={momentum} />
    </header>
  )
}
