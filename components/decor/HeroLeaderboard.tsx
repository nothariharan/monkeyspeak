'use client'

import { useMemo } from 'react'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import { getLeaderboardBoard } from '@/lib/stats/leaderboard'
import { useTestStore, type Duration } from '@/store/testStore'

const DURATIONS: Duration[] = [15, 30, 60, 120]

const MEDAL_LABEL: Record<string, string> = {
  gold: '1',
  silver: '2',
  bronze: '3',
}

function LeaderboardRowView({
  rank,
  medal,
  emoji,
  name,
  wpm,
  rankClass = '',
}: {
  rank: number | string
  medal?: string
  emoji: string
  name: string
  wpm: number | null
  rankClass?: string
}) {
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
      </div>
      <span className="hero-player-score tabular-nums">
        {wpm != null ? `${wpm} wpm` : '-- wpm'}
      </span>
    </>
  )
}

export default function HeroLeaderboard() {
  const duration = useTestStore((s) => s.duration)
  const setDuration = useTestStore((s) => s.setDuration)
  const promptType = useTestStore((s) => s.promptType)
  const name = useTestStore((s) => s.settings.leaderboardName)
  const savedEmoji = useTestStore((s) => s.settings.leaderboardEmoji)
  const { entries, loading, error } = useLeaderboard()

  const board = useMemo(
    () => getLeaderboardBoard(entries, duration, promptType, name),
    [entries, duration, promptType, name]
  )

  const userEmoji = board.userRow?.emoji ?? savedEmoji ?? '🐵'

  return (
    <aside className="hero-leaderboard paper-panel hero-animate" aria-label="Leaderboard">
      <span className="hero-paper-tape hero-paper-tape--green" aria-hidden />
      <div className="hero-leaderboard-head">
        <div className="hero-leaderboard-title">
          <span className="hero-leaderboard-title-icon" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.955.734H5.808a1 1 0 0 1-.957-.734L2.018 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
              <path d="M5 21h14" />
            </svg>
          </span>
          <h2>leaderboard</h2>
        </div>
        <span className="hero-leaderboard-note">{promptType}</span>
      </div>

      <div className="hero-leaderboard-tabs hero-leaderboard-tabs--duration" role="tablist" aria-label="Leaderboard duration">
        {DURATIONS.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={duration === value}
            className={duration === value ? 'active' : ''}
            onClick={() => setDuration(value)}
          >
            {value}s
          </button>
        ))}
      </div>

      <div className="hero-leaderboard-list">
        {loading ? (
          <p className="hero-leaderboard-empty font-mono">loading scores...</p>
        ) : error ? (
          <p className="hero-leaderboard-empty font-mono">{error}</p>
        ) : board.topRows.length === 0 ? (
          <p className="hero-leaderboard-empty font-mono">no saved scores yet</p>
        ) : (
          board.topRows.map((row) => (
            <div
              key={row.id}
              className={`hero-leaderboard-row${row.isUser ? ' hero-leaderboard-row--you' : ''}`}
            >
              <LeaderboardRowView
                rank={row.rank}
                medal={row.medal}
                emoji={row.emoji ?? '🐵'}
                name={row.name}
                wpm={row.wpm}
                rankClass={row.isUser ? 'you' : ''}
              />
            </div>
          ))
        )}
      </div>

      {!loading && (
        <div className="hero-leaderboard-you">
          {board.userRow ? (
            <LeaderboardRowView
              rank={board.userRow.rank}
              emoji={board.userRow.emoji ?? userEmoji}
              name="you"
              wpm={board.userRow.wpm}
              rankClass="you"
            />
          ) : (
            <LeaderboardRowView
              rank="new"
              emoji={userEmoji}
              name={name?.trim() || 'you'}
              wpm={null}
              rankClass="you"
            />
          )}
        </div>
      )}

      <span className="hero-pencil-note">keep climbing!</span>
    </aside>
  )
}
