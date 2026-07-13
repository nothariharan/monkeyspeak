'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import LeaderboardRow from '@/components/leaderboard/LeaderboardRow'
import {
  LEADERBOARD_DURATIONS,
  promptTypeToUrl,
  promptLabel,
  resolveBoardPromptType,
} from '@/components/leaderboard/leaderboardUtils'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import { getLeaderboardBoard } from '@/lib/stats/leaderboard'
import { useTestStore } from '@/store/testStore'

export default function HeroLeaderboard() {
  const duration = useTestStore((s) => s.duration)
  const setDuration = useTestStore((s) => s.setDuration)
  const promptType = useTestStore((s) => s.promptType)
  const name = useTestStore((s) => s.settings.leaderboardName)
  const savedEmoji = useTestStore((s) => s.settings.leaderboardEmoji)
  const { entries, loading, error } = useLeaderboard()

  const boardPrompt = resolveBoardPromptType(promptType)

  const board = useMemo(
    () => getLeaderboardBoard(entries, duration, boardPrompt, name),
    [entries, duration, boardPrompt, name]
  )

  const userEmoji = board.userRow?.emoji ?? savedEmoji ?? '🐵'
  const fullBoardHref = `/leaderboard?duration=${duration}&prompt=${encodeURIComponent(promptTypeToUrl(promptType))}`
  const showMoreLink = !loading && !error && board.topRows.length > 0

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
        <span className="hero-leaderboard-note">{promptLabel(promptType)}</span>
      </div>

      <div className="hero-leaderboard-tabs hero-leaderboard-tabs--duration" role="tablist" aria-label="Leaderboard duration">
        {LEADERBOARD_DURATIONS.map((value) => (
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
              <LeaderboardRow
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

      {showMoreLink && (
        <p className="hero-leaderboard-more">
          want to see everyone?{' '}
          <Link href={fullBoardHref}>peek the full leaderboard →</Link>
        </p>
      )}

      {!loading && (
        <div className="hero-leaderboard-you">
          {board.userRow ? (
            <LeaderboardRow
              rank={board.userRow.rank}
              emoji={board.userRow.emoji ?? userEmoji}
              name="you"
              wpm={board.userRow.wpm}
              rankClass="you"
            />
          ) : (
            <LeaderboardRow
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
