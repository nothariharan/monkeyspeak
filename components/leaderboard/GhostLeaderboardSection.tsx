'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTestStore, type GhostRaceEntry } from '@/store/testStore'
import { formatBoardDate, promptLabel } from '@/components/leaderboard/leaderboardUtils'
import type { PromptType } from '@/store/testStore'

/** Longest run of consecutive wins across contested races (chronological order). */
function bestWinStreak(chronological: GhostRaceEntry[]): number {
  let best = 0
  let run = 0
  for (const race of chronological) {
    if (race.ghostWpm <= 0) continue
    if (race.won) {
      run += 1
      best = Math.max(best, run)
    } else {
      run = 0
    }
  }
  return best
}

/** Win streak counting back from the most recent contested race. */
function currentWinStreak(newestFirst: GhostRaceEntry[]): number {
  let run = 0
  for (const race of newestFirst) {
    if (race.ghostWpm <= 0) continue
    if (race.won) run += 1
    else break
  }
  return run
}

export default function GhostLeaderboardSection() {
  const races = useTestStore((s) => s.settings.ghostRaces)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const stats = useMemo(() => {
    const list = races ?? []
    const contested = list.filter((r) => r.ghostWpm > 0)
    const wins = contested.filter((r) => r.won).length
    const winRate = contested.length ? Math.round((wins / contested.length) * 100) : 0
    const bestMargin = contested.reduce((max, r) => Math.max(max, r.marginWpm), 0)
    return {
      total: list.length,
      contested: contested.length,
      wins,
      winRate,
      bestMargin,
      currentStreak: currentWinStreak(list),
      bestStreak: bestWinStreak([...list].reverse()),
    }
  }, [races])

  if (!mounted) {
    return (
      <section className="hero-widget leaderboard-section" aria-label="Ghost trace history">
        <p className="hero-leaderboard-empty font-mono">loading your races...</p>
      </section>
    )
  }

  const list = races ?? []

  return (
    <section className="hero-widget leaderboard-section" aria-label="Ghost trace history">
      <div className="hero-widget-head">
        <span className="hero-widget-icon" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ghost-race/ghost-trace-badge.png" alt="" width={16} height={16} style={{ borderRadius: 4, objectFit: 'cover' }} />
        </span>
        <div className="hero-widget-copy">
          <h2>ghost trace record</h2>
          <p>you vs the replay of your own best pace</p>
        </div>
      </div>

      <div className="ghost-record-metrics">
        {[
          { label: 'races run', value: String(stats.total) },
          { label: 'win rate', value: stats.contested ? `${stats.winRate}%` : '—' },
          { label: 'wins', value: stats.contested ? `${stats.wins}/${stats.contested}` : '—' },
          { label: 'best margin', value: stats.bestMargin > 0 ? `+${stats.bestMargin} wpm` : '—' },
          { label: 'win streak', value: String(stats.currentStreak) },
          { label: 'best streak', value: String(stats.bestStreak) },
        ].map(({ label, value }) => (
          <div key={label} className="ghost-record-metric">
            <p className="stat-label">{label}</p>
            <p className="stat-value">{value}</p>
          </div>
        ))}
      </div>

      <div className="leaderboard-full-list" tabIndex={0} aria-label="Recent ghost traces">
        {list.length === 0 ? (
          <p className="hero-leaderboard-empty font-mono">
            no traces yet — set a speed best, then race your ghost to fill this board
          </p>
        ) : (
          list.map((race, index) => {
            const hadGhost = race.ghostWpm > 0
            const outcome = !hadGhost ? 'pace' : race.won ? 'win' : 'loss'
            const marginLabel = !hadGhost
              ? 'first pace set'
              : `${race.marginWpm >= 0 ? '+' : ''}${race.marginWpm} wpm vs ghost`
            return (
              <div key={`${race.date}-${index}`} className="leaderboard-full-row ghost-record-row">
                <span className={`ghost-result-badge ghost-result-badge--${outcome}`}>
                  {outcome === 'win' ? 'won' : outcome === 'loss' ? 'lost' : 'set'}
                </span>
                <div className="hero-player-copy">
                  <strong>
                    {promptLabel(race.promptType as PromptType)} · {race.duration}s
                  </strong>
                  <span>
                    {marginLabel} · {formatBoardDate(race.date)}
                  </span>
                </div>
                <span className="ghost-record-scores tabular-nums">
                  <b>{race.playerWpm}</b>
                  <small>you</small>
                  <em aria-hidden>vs</em>
                  <b>{hadGhost ? race.ghostWpm : '—'}</b>
                  <small>ghost</small>
                </span>
              </div>
            )
          })
        )}
      </div>

      <p className="leaderboard-board-count font-mono">
        {list.length === 0
          ? 'race your best to start a record'
          : `${list.length} race${list.length === 1 ? '' : 's'} tracked · stored locally, no account needed`}
      </p>
    </section>
  )
}
