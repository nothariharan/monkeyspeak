'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface UseTimerReturn {
  timeRemaining: number
  isRunning: boolean
  isWarning: boolean          // true when ≤ 5s remain
  start: () => void
  stop: () => void
  reset: (duration?: number) => void
}

export function useTimer(durationSeconds: number, onComplete?: () => void): UseTimerReturn {
  const [timeRemaining, setTimeRemaining] = useState(durationSeconds * 1000)
  const [isRunning, setIsRunning]         = useState(false)

  const intervalRef  = useRef<NodeJS.Timeout | null>(null)
  const remainingRef = useRef(durationSeconds * 1000)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  })

  const start = useCallback(() => {
    if (isRunning) return
    setIsRunning(true)

    const TICK = 100 // ms
    intervalRef.current = setInterval(() => {
      remainingRef.current -= TICK
      setTimeRemaining(remainingRef.current)

      if (remainingRef.current <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setIsRunning(false)
        setTimeRemaining(0)
        onCompleteRef.current?.()
      }
    }, TICK)
  }, [isRunning])

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setIsRunning(false)
  }, [])

  const reset = useCallback((newDuration?: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    const ms = (newDuration ?? durationSeconds) * 1000
    remainingRef.current = ms
    setTimeRemaining(ms)
    setIsRunning(false)
  }, [durationSeconds])

  // Reset when duration changes externally
  useEffect(() => {
    reset(durationSeconds)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationSeconds])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const isWarning = timeRemaining <= 5000 && timeRemaining > 0

  return { timeRemaining, isRunning, isWarning, start, stop, reset }
}
