'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchLeaderboard } from '@/lib/leaderboard/client'
import type { LeaderboardEntry } from '@/store/testStore'
import { useTestStore } from '@/store/testStore'

export function useLeaderboard(limit = 20) {
  const duration = useTestStore((s) => s.duration)
  const promptType = useTestStore((s) => s.promptType)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchLeaderboard(duration, promptType, limit)
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

  useEffect(() => {
    const onRefresh = () => { void refresh() }
    window.addEventListener('leaderboard:refresh', onRefresh)
    return () => window.removeEventListener('leaderboard:refresh', onRefresh)
  }, [refresh])

  return { entries, loading, error, refresh }
}
