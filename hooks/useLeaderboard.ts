'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchLeaderboard } from '@/lib/leaderboard/client'
import { resolveBoardPromptType } from '@/components/leaderboard/leaderboardUtils'
import type { Duration, LeaderboardEntry, PromptType } from '@/store/testStore'
import { useTestStore } from '@/store/testStore'

type UseLeaderboardOptions = {
  limit?: number
  duration?: Duration
  promptType?: PromptType
}

// home widget can call useLeaderboard() with no args
// full page passes its own filters so it doesn't fight the test config bar
export function useLeaderboard(options: UseLeaderboardOptions | number = {}) {
  const opts: UseLeaderboardOptions = typeof options === 'number' ? { limit: options } : options

  const storeDuration = useTestStore((s) => s.duration)
  const storePromptType = useTestStore((s) => s.promptType)
  const duration = opts.duration ?? storeDuration
  const promptType = opts.promptType ?? storePromptType
  const limit = opts.limit ?? 20

  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const boardPrompt = resolveBoardPromptType(promptType)
      const rows = await fetchLeaderboard(duration, boardPrompt, limit)
      setEntries(rows)
    } catch (err) {
      setEntries([])
      setError(err instanceof Error ? err.message : 'leaderboard unavailable')
    } finally {
      setLoading(false)
    }
  }, [duration, promptType, limit])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // after someone saves a score we broadcast this from the save prompt
  useEffect(() => {
    const onRefresh = () => { void refresh() }
    window.addEventListener('leaderboard:refresh', onRefresh)
    return () => window.removeEventListener('leaderboard:refresh', onRefresh)
  }, [refresh])

  return { entries, loading, error, refresh }
}
