'use client'

import { WORLD_TIERS, wpmToTrackProgress } from '@/lib/game/worldTiers'

interface ProgressTrackProps {
  wpm: number
}

const TRACK_TIERS = WORLD_TIERS.filter((t) => t.id !== 'mythic')

export default function ProgressTrack({ wpm }: ProgressTrackProps) {
  const progress = wpmToTrackProgress(wpm)

  return (
    <footer className="game-progress-track" aria-label="World progression">
      <span className="game-track-label game-track-label--start">START</span>
      <div className="game-track-rail">
        <div className="game-track-fill" style={{ width: `${progress * 100}%` }} />
        <div
          className="game-track-dot"
          style={{ left: `${progress * 100}%` }}
          aria-hidden
        />
        {TRACK_TIERS.map((tier, i) => {
          const pos = (tier.minWpm / 200) * 100
          return (
            <div
              key={tier.id}
              className="game-track-milestone"
              style={{ left: `${pos}%` }}
            >
              <span
                className="game-track-icon"
                style={{ background: tier.color }}
                aria-hidden
              >
                {tier.id === 'ground' && '⛰'}
                {tier.id === 'sky' && '☁'}
                {tier.id === 'space' && '🪐'}
                {tier.id === 'heaven' && '☀'}
              </span>
              <span className="game-track-tier-label">{tier.label.toUpperCase()}</span>
            </div>
          )
        })}
      </div>
      <span className="game-track-label game-track-label--end">NEXT LEVEL</span>
    </footer>
  )
}
