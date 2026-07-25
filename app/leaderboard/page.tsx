'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '@/components/Header'
import ProfileHub from '@/components/ProfileHub'
import SettingsPanel from '@/components/SettingsPanel'
import LeaderboardRow from '@/components/leaderboard/LeaderboardRow'
import LeaderboardFilters from '@/components/leaderboard/LeaderboardFilters'
import ClarityLeaderboardSection from '@/components/leaderboard/ClarityLeaderboardSection'
import PersonalStatsSection from '@/components/leaderboard/PersonalStatsSection'
import {
  formatBoardDate,
  parseDurationParam,
  promptLabel,
  promptTypeFromUrl,
  promptTypeToUrl,
  resolveBoardPromptType,
} from '@/components/leaderboard/leaderboardUtils'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import { getLeaderboardBoard } from '@/lib/stats/leaderboard'
import { useTestStore, type Duration, type PromptType } from '@/store/testStore'

function LeaderboardPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const name = useTestStore((s) => s.settings.leaderboardName)
  const savedEmoji = useTestStore((s) => s.settings.leaderboardEmoji)
  const mode = useTestStore((s) => s.mode)
  const isClarity = mode === 'clarity'

  const [profileOpen, setProfileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  const [duration, setDuration] = useState<Duration>(() => parseDurationParam(searchParams.get('duration')))
  const [promptType, setPromptType] = useState<PromptType>(() => promptTypeFromUrl(searchParams.get('prompt')))

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    setDuration(parseDurationParam(searchParams.get('duration')))
    setPromptType(promptTypeFromUrl(searchParams.get('prompt')))
  }, [searchParams])

  // if someone lands on /leaderboard#stats, scroll them down gently
  useEffect(() => {
    if (!mounted || window.location.hash !== '#stats') return
    const el = document.getElementById('stats')
    if (!el) return
    const timer = window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [mounted])

  const updateFilters = (nextDuration: Duration, nextPrompt: PromptType) => {
    setDuration(nextDuration)
    setPromptType(nextPrompt)
    const params = new URLSearchParams({
      duration: String(nextDuration),
      prompt: promptTypeToUrl(nextPrompt),
    })
    router.replace(`/leaderboard?${params.toString()}`)
  }

  const BOARD_LIMIT = 50
  // over-fetch by one so we only claim "there's more" when a 51st row actually exists
  const { entries, loading, error } = useLeaderboard({ limit: BOARD_LIMIT + 1, duration, promptType })

  const hitFetchCap = entries.length > BOARD_LIMIT
  const visibleEntries = useMemo(() => entries.slice(0, BOARD_LIMIT), [entries])

  const boardPrompt = resolveBoardPromptType(promptType)

  const board = useMemo(
    () => getLeaderboardBoard(visibleEntries, duration, boardPrompt, name),
    [visibleEntries, duration, boardPrompt, name]
  )

  const userEmoji = board.userRow?.emoji ?? savedEmoji ?? '🐵'
  const playerCount = board.allRows.length

  if (!mounted) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header onSettingsOpen={() => setSettingsOpen(true)} onProfileOpen={() => setProfileOpen(true)} />
        <main className="flex-1 flex items-center justify-center px-6 py-8 mx-auto w-full max-w-4xl">
          <p className="stats-page-subtitle animate-pulse">loading the board...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header onSettingsOpen={() => setSettingsOpen(true)} onProfileOpen={() => setProfileOpen(true)} />

      <main className="leaderboard-page flex-1 flex flex-col px-6 py-8 mx-auto w-full max-w-4xl gap-6">
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col">
            <h1 className="stats-page-title">leaderboard</h1>
            <p className="stats-page-subtitle">
              {isClarity
                ? 'speech-to-text tools ranked by verified clarity benchmarks.'
                : 'global rankings plus your local speaking stats in one place.'}
            </p>
          </div>
          <Link href="/">
            <button type="button" className="desk-btn desk-btn-primary text-xs px-4 py-2">
              ← back to test
            </button>
          </Link>
        </section>

        {isClarity ? (
          <ClarityLeaderboardSection />
        ) : (
        <section className="hero-widget leaderboard-section" aria-label="Global leaderboard">
          <div className="hero-widget-head">
            <span className="hero-widget-icon" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.955.734H5.808a1 1 0 0 1-.957-.734L2.018 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
                <path d="M5 21h14" />
              </svg>
            </span>
            <div className="hero-widget-copy">
              <h2>top scores</h2>
              <p>{promptLabel(promptType)} · {duration}s</p>
            </div>
          </div>

          <LeaderboardFilters
            duration={duration}
            promptType={promptType}
            onDurationChange={(value) => updateFilters(value, promptType)}
            onPromptTypeChange={(value) => updateFilters(duration, value)}
          />

          <div className="leaderboard-full-list" tabIndex={0} aria-label="Leaderboard rankings">
            {loading ? (
              <p className="hero-leaderboard-empty font-mono">loading scores...</p>
            ) : error ? (
              <p className="hero-leaderboard-empty font-mono">{error}</p>
            ) : board.allRows.length === 0 ? (
              <p className="hero-leaderboard-empty font-mono">no saved scores yet — be the first monkey</p>
            ) : (
              board.allRows.map((row) => (
                <div
                  key={row.id}
                  className={`leaderboard-full-row hero-leaderboard-row${row.isUser ? ' hero-leaderboard-row--you' : ''}`}
                >
                  <LeaderboardRow
                    rank={row.rank}
                    medal={row.medal}
                    emoji={row.emoji ?? '🐵'}
                    name={row.isUser ? 'you' : row.name}
                    wpm={row.wpm}
                    accuracy={row.accuracy}
                    dateLabel={formatBoardDate(row.date)}
                    rankClass={row.isUser ? 'you' : ''}
                    variant="full"
                  />
                </div>
              ))
            )}
          </div>

          {!loading && !board.userRow && (
            <div className="hero-leaderboard-you">
              <LeaderboardRow
                rank="new"
                emoji={userEmoji}
                name={name?.trim() || 'you'}
                wpm={null}
                rankClass="you"
              />
            </div>
          )}

          {!loading && !error && (
            <p className="leaderboard-board-count font-mono">
              {playerCount === 0
                ? 'nobody on this board yet'
                : `${playerCount} player${playerCount === 1 ? '' : 's'} on this board`}
              {hitFetchCap ? ` · showing top ${BOARD_LIMIT} for now` : ''}
            </p>
          )}
        </section>
        )}

        <section id="stats" className="hero-widget leaderboard-section" aria-label="Your stats">
          <div className="hero-widget-head">
            <span className="hero-widget-icon" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </span>
            <div className="hero-widget-copy">
              <h2>build your stats</h2>
              <p>your local runs, trends, and missed words</p>
            </div>
          </div>

          <PersonalStatsSection />
        </section>
      </main>

      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ProfileHub isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  )
}

export default function LeaderboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="stats-page-subtitle animate-pulse">loading the board...</p>
        </div>
      }
    >
      <LeaderboardPageContent />
    </Suspense>
  )
}
