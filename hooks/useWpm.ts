'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useTestStore } from '@/store/testStore'
import type { WordResult } from '@/store/testStore'

interface UseWpmReturn {
  wpm: number
  peakWpm: number
  consistency: number
}

/**
 * Tracks confirmed words and computes WPM every 500ms.
 * Does not display WPM until 3 seconds have elapsed (§7.3).
 * Records 5-second snapshots for consistency calc (§7.4).
 */
export function useWpm(
  confirmedWords: WordResult[],
  fillerCount: number,
  startTimeRef: React.MutableRefObject<number | null>
): UseWpmReturn {
  const { wpm, peakWpm, consistency, setWpm, setPeakWpm, addWpmSnapshot } = useTestStore()

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const snapshotIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const calcWpm = useCallback(() => {
    if (!startTimeRef.current) return
    const elapsedMs = Date.now() - startTimeRef.current

    if (elapsedMs < 3000) {
      setWpm(0)
      return
    }

    const netWords = Math.max(0, confirmedWords.length - fillerCount)
    const elapsedMin = elapsedMs / 60_000
    const computed = Math.round(netWords / elapsedMin)
    setWpm(computed)

    if (computed > peakWpm) setPeakWpm(computed)
  }, [confirmedWords.length, fillerCount, peakWpm, setWpm, setPeakWpm, startTimeRef])

  const recordSnapshot = useCallback(() => {
    if (!startTimeRef.current) return
    if (wpm > 0) {
      addWpmSnapshot({ wpm, timestamp: Date.now() })
    }
  }, [wpm, addWpmSnapshot, startTimeRef])

  // Start intervals when confirmedWords first populates (i.e. test is running)
  useEffect(() => {
    if (!intervalRef.current) {
      intervalRef.current = setInterval(calcWpm, 500)
    }
    if (!snapshotIntervalRef.current) {
      snapshotIntervalRef.current = setInterval(recordSnapshot, 5000)
    }
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      if (snapshotIntervalRef.current) { clearInterval(snapshotIntervalRef.current); snapshotIntervalRef.current = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recalc on every word addition
  useEffect(() => {
    calcWpm()
  }, [confirmedWords.length, calcWpm])

  return { wpm, peakWpm, consistency }
}
