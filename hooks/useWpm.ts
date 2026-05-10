'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useTestStore } from '@/store/testStore'
import type { WordResult } from '@/store/testStore'
import { netWpmFromChars } from '@/lib/stats/wpm'

interface UseWpmReturn {
  wpm: number
  peakWpm: number
  consistency: number
}

/**
 * Tracks confirmed words and computes WPM every 500ms using the MonkeyType
 * 5-character standard (correct chars / 5 / elapsedMinutes).
 * Does not display WPM until 3 seconds have elapsed (§7.3).
 * Records 5-second snapshots for consistency fallback (§7.4).
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

    const s = useTestStore.getState()
    const correctWords = s.confirmedWords.filter((w) => w.isCorrect)
    // +1 per word accounts for the trailing space in the 5-char standard
    const correctChars = correctWords.reduce((sum, w) => sum + w.word.length + 1, 0)
    const computed = netWpmFromChars(correctChars, elapsedMs / 1000)
    setWpm(computed)

    if (computed > peakWpm) setPeakWpm(computed)
  }, [peakWpm, setWpm, setPeakWpm, startTimeRef])

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
