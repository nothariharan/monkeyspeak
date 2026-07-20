'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchClarityLeaderboard, type ClarityLeaderboardRow } from '@/lib/clarityLeaderboard/client'

export function useClarityLeaderboard() {
  const [rows, setRows] = useState<ClarityLeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try { setRows(await fetchClarityLeaderboard()) }
    catch (reason) { setRows([]); setError(reason instanceof Error ? reason.message : 'could not load clarity board') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    const onRefresh = () => { void refresh() }
    window.addEventListener('clarity-benchmark:refresh', onRefresh)
    return () => window.removeEventListener('clarity-benchmark:refresh', onRefresh)
  }, [refresh])
  return { rows, loading, error, refresh }
}
