'use client'

import { MEDAL_LABEL } from '@/components/leaderboard/leaderboardUtils'

type LeaderboardRowProps = {
  rank: number | string
  medal?: string
  emoji: string
  name: string
  wpm: number | null
  accuracy?: number | null
  dateLabel?: string
  rankClass?: string
  variant?: 'compact' | 'full'
}

export default function LeaderboardRow({
  rank,
  medal,
  emoji,
  name,
  wpm,
  accuracy,
  dateLabel,
  rankClass = '',
  variant = 'compact',
}: LeaderboardRowProps) {
  const isFull = variant === 'full'

  return (
    <>
      <span className={`hero-rank hero-rank--${medal ?? (rankClass || 'plain')}`}>
        {medal ? MEDAL_LABEL[medal] : rank}
      </span>
      <span className="hero-player-emoji" aria-hidden>
        {emoji}
      </span>
      <div className="hero-player-copy">
        <strong>{name}</strong>
        {isFull && (accuracy != null || dateLabel) && (
          <span>
            {accuracy != null ? `${accuracy}% acc` : ''}
            {accuracy != null && dateLabel ? ' · ' : ''}
            {dateLabel ?? ''}
          </span>
        )}
      </div>
      <span className="hero-player-score tabular-nums">
        {wpm != null ? `${wpm} wpm` : '-- wpm'}
      </span>
    </>
  )
}
