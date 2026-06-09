'use client'

import { useRef, useState, useEffect } from 'react'

const MOMENTUM_DRAIN = 0.55
const IDLE_MS = 900
const MIN_GAP_SEC = 0.1
const MAX_GAP_SEC = 4
const VOICE_THRESHOLD = 0.06

/** Map words-per-second to momentum (100 ≈ 4.5 wps baseline, no upper cap). */
function rateToMomentum(wordsPerSec: number): number {
  const rate = Math.max(0, wordsPerSec)
  return Math.round((rate / 4.5) * 100)
}

interface UseSpeakingMomentumOptions {
  dissolvedCount: number
  rawWpms: number[]
  isActive: boolean
  energy: number
  isSpeaking: boolean
}

export function useSpeakingMomentum({
  dissolvedCount,
  rawWpms,
  isActive,
  energy,
  isSpeaking,
}: UseSpeakingMomentumOptions): number {
  const momentumRef = useRef(0)
  const lastDissolvedRef = useRef(0)
  const lastAdvanceAtRef = useRef<number | null>(null)
  const energyRef = useRef(energy)
  const isSpeakingRef = useRef(isSpeaking)
  const [momentum, setMomentum] = useState(0)
  const frameCountRef = useRef(0)

  useEffect(() => {
    energyRef.current = energy
    isSpeakingRef.current = isSpeaking
  }, [energy, isSpeaking])

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
      const fromWpm = Math.round((latestWpm / 180) * 100)
      target = Math.round(target * 0.5 + fromWpm * 0.5)
    }

    momentumRef.current = momentumRef.current * 0.3 + target * 0.7

    lastAdvanceAtRef.current = now
    lastDissolvedRef.current = dissolvedCount
  }, [dissolvedCount, rawWpms, isActive])

  useEffect(() => {
    if (!isActive) return

    let raf = 0
    const tick = () => {
      const now = Date.now()
      const lastAt = lastAdvanceAtRef.current
      const speaking = isSpeakingRef.current
      const currentEnergy = energyRef.current
      const voiceActive = speaking && currentEnergy > VOICE_THRESHOLD

      const idle =
        !voiceActive && (lastAt === null || now - lastAt > IDLE_MS)

      if (voiceActive) {
        const voiceTarget = currentEnergy * 85
        momentumRef.current = momentumRef.current * 0.88 + voiceTarget * 0.12
      }

      if (idle) {
        momentumRef.current = Math.max(0, momentumRef.current - MOMENTUM_DRAIN)
      } else if (!voiceActive && lastAt !== null) {
        const sinceWord = (now - lastAt) / 1000
        if (sinceWord > 0.4) {
          momentumRef.current = Math.max(0, momentumRef.current - MOMENTUM_DRAIN * 0.35)
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
