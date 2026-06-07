'use client'

import { useRef, useState, useEffect } from 'react'

const MOMENTUM_DRAIN = 0.7
const IDLE_MS = 700
const MIN_GAP_SEC = 0.1
const MAX_GAP_SEC = 4

/** Map words-per-second to a 0–100 momentum score. */
function rateToMomentum(wordsPerSec: number): number {
  const rate = Math.max(0, Math.min(4.5, wordsPerSec))
  return Math.round((rate / 4.5) * 100)
}

interface UseSpeakingMomentumOptions {
  dissolvedCount: number
  rawWpms: number[]
  isActive: boolean
}

export function useSpeakingMomentum({
  dissolvedCount,
  rawWpms,
  isActive,
}: UseSpeakingMomentumOptions): number {
  const momentumRef = useRef(0)
  const lastDissolvedRef = useRef(0)
  const lastAdvanceAtRef = useRef<number | null>(null)
  const [momentum, setMomentum] = useState(0)
  const frameCountRef = useRef(0)

  useEffect(() => {
    if (!isActive) {
      momentumRef.current = 0
      lastDissolvedRef.current = 0
      lastAdvanceAtRef.current = null
      setMomentum(0)
    }
  }, [isActive])

  useEffect(() => {
    if (!isActive || dissolvedCount <= lastDissolvedRef.current) return

    const now = Date.now()
    let target = 18

    if (lastAdvanceAtRef.current !== null) {
      const gapSec = Math.max(
        MIN_GAP_SEC,
        Math.min(MAX_GAP_SEC, (now - lastAdvanceAtRef.current) / 1000)
      )
      target = rateToMomentum(1 / gapSec)
    }

    const latestWpm = rawWpms[rawWpms.length - 1]
    if (latestWpm != null && latestWpm > 0) {
      const fromWpm = Math.min(100, Math.round((latestWpm / 180) * 100))
      target = Math.round(target * 0.5 + fromWpm * 0.5)
    }

    momentumRef.current = Math.min(
      100,
      momentumRef.current * 0.3 + target * 0.7
    )

    lastAdvanceAtRef.current = now
    lastDissolvedRef.current = dissolvedCount
  }, [dissolvedCount, rawWpms, isActive])

  useEffect(() => {
    if (!isActive) return

    let raf = 0
    const tick = () => {
      const now = Date.now()
      const lastAt = lastAdvanceAtRef.current
      const idle = lastAt === null || now - lastAt > IDLE_MS

      if (idle) {
        momentumRef.current = Math.max(0, momentumRef.current - MOMENTUM_DRAIN)
      } else {
        const sinceWord = (now - lastAt) / 1000
        if (sinceWord > 0.35) {
          momentumRef.current = Math.max(0, momentumRef.current - MOMENTUM_DRAIN * 0.4)
        }
      }

      frameCountRef.current++
      if (frameCountRef.current % 4 === 0) {
        setMomentum(Math.round(momentumRef.current))
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isActive])

  return momentum
}
