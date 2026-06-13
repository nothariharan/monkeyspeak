import type { Duration, LeaderboardEntry, PromptType } from '@/store/testStore'

export type LeaderboardRow = LeaderboardEntry & {
  rank: number
  medal?: 'gold' | 'silver' | 'bronze'
  isUser?: boolean
}

export type LeaderboardBoard = {
  topRows: LeaderboardRow[]
  userRow: LeaderboardRow | null
  allRows: LeaderboardRow[]
}

const LEADERBOARD_EMOJIS = [
  '🐵', '🦊', '🐸', '🦁', '🐯', '🐻', '🐼', '🐨', '🐙', '🦄',
  '🤖', '👾', '🎮', '🎯', '🚀', '⚡', '🔥', '💫', '🌟', '🎸',
  '🥁', '🎤', '🎧', '🦜', '🐧', '🦉', '🐝', '🦋', '🍌', '🥥',
] as const

export const DEFAULT_LEADERBOARD_EMOJI = '🐵'

export const LEADERBOARD_EMOJI_OPTIONS: readonly string[] = LEADERBOARD_EMOJIS

export function pickRandomLeaderboardEmoji(): string {
  return LEADERBOARD_EMOJIS[Math.floor(Math.random() * LEADERBOARD_EMOJIS.length)] ?? DEFAULT_LEADERBOARD_EMOJI
}

function isUserEntry(entry: LeaderboardEntry, userName?: string): boolean {
  if (!userName) return false
  return entry.name.trim().toLowerCase() === userName.trim().toLowerCase()
}

function assignMedals(rows: Omit<LeaderboardRow, 'rank' | 'medal'>[]): LeaderboardRow[] {
  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
    medal: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : undefined,
  }))
}

export function getLeaderboardBoard(
  entries: LeaderboardEntry[],
  duration: Duration,
  promptType: PromptType,
  userName?: string
): LeaderboardBoard {
  const filtered = entries
    .filter((entry) => entry.duration === duration && entry.promptType === promptType)
    .map((entry) => ({
      ...entry,
      emoji: entry.emoji ?? '🐵',
      isUser: isUserEntry(entry, userName),
    }))

  const allRows = assignMedals(
    [...filtered].sort((a, b) => b.wpm - a.wpm || b.accuracy - a.accuracy)
  )

  const userRow = allRows.find((row) => row.isUser) ?? null
  const topRows = allRows.filter((row) => !row.isUser).slice(0, 5)

  return { topRows, userRow, allRows }
}

export function getUserBestWpm(
  entries: LeaderboardEntry[],
  duration: Duration,
  promptType: PromptType,
  personalBestWpm?: number
): number {
  const fromBoard = entries
    .filter((entry) => entry.duration === duration && entry.promptType === promptType)
    .reduce((best, entry) => Math.max(best, entry.wpm), 0)

  return Math.max(fromBoard, personalBestWpm ?? 0)
}

/** @deprecated use getLeaderboardBoard */
export function getLeaderboardRows(
  entries: LeaderboardEntry[],
  duration: Duration,
  name?: string
): LeaderboardRow[] {
  return getLeaderboardBoard(entries, duration, 'sentences', name).allRows
}
