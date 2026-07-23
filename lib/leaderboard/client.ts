import type { Duration, LeaderboardEntry, PromptType } from '@/store/testStore'

export type SubmitLeaderboardPayload = {
  name: string
  emoji: string
  wpm: number
  accuracy: number
  duration: Duration
  promptType: PromptType
  elapsedSec: number
  runToken: string
}

type LeaderboardResponse = {
  entries?: LeaderboardEntry[]
  entry?: LeaderboardEntry
  error?: string
}

async function readLeaderboardResponse(res: Response): Promise<LeaderboardResponse> {
  const raw = await res.text()
  if (!raw.trim()) return {}

  try {
    return JSON.parse(raw) as LeaderboardResponse
  } catch {
    // dev server sometimes returns an html error page instead of json
    throw new Error('leaderboard unavailable right now')
  }
}

export async function fetchLeaderboard(
  duration: Duration,
  promptType: PromptType,
  limit = 20
): Promise<LeaderboardEntry[]> {
  const params = new URLSearchParams({
    duration: String(duration),
    promptType,
    limit: String(limit),
  })

  const res = await fetch(`/api/leaderboard?${params.toString()}`, { cache: 'no-store' })
  const data = await readLeaderboardResponse(res)

  if (!res.ok) {
    throw new Error(data.error ?? 'leaderboard unavailable')
  }

  return data.entries ?? []
}

export async function submitLeaderboardScore(payload: SubmitLeaderboardPayload): Promise<LeaderboardEntry> {
  const res = await fetch('/api/leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await readLeaderboardResponse(res)

  if (!res.ok) {
    throw new Error(data.error ?? 'could not save score')
  }

  if (!data.entry) throw new Error('could not save score')
  return data.entry
}
