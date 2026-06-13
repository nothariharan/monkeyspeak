import type { Duration, LeaderboardEntry, PromptType } from '@/store/testStore'

export type SubmitLeaderboardPayload = {
  name: string
  emoji: string
  wpm: number
  accuracy: number
  duration: Duration
  promptType: PromptType
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
  const data = (await res.json()) as { entries?: LeaderboardEntry[]; error?: string }

  if (!res.ok) {
    throw new Error(data.error ?? 'leaderboard fetch failed')
  }

  return data.entries ?? []
}

export async function submitLeaderboardScore(payload: SubmitLeaderboardPayload): Promise<LeaderboardEntry> {
  const res = await fetch('/api/leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = (await res.json()) as { entry?: LeaderboardEntry; error?: string }

  if (!res.ok) {
    throw new Error(data.error ?? 'leaderboard save failed')
  }

  if (!data.entry) throw new Error('leaderboard save failed')
  return data.entry
}
