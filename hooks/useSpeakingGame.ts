'use client'

import { useRef, useState, useEffect, useMemo } from 'react'
import { LiveScorer, type GameEvent, type WordState } from '@/lib/liveAlign'
import { computeInterimDissolveIndex } from '@/lib/interimDissolve'
import { netWpmFromChars, rawWpmFromChars } from '@/lib/stats/wpm'

export interface SpeakingGameState {
  wordStates: WordState[]
  currentIndex: number
  previewIndex: number
  displayIndex: number
  streak: number
  height: number
  liveWpm: number
  liveAccuracy: number
  events: GameEvent[]
  rawWpms: number[]
}

interface UseSpeakingGameOptions {
  prompt: string[]
  confirmedWords: string[]
  previewWords: string[]
  isActive: boolean
  startedAt: number | null
}

export function useSpeakingGame({
  prompt,
  confirmedWords,
  previewWords,
  isActive,
  startedAt,
}: UseSpeakingGameOptions): SpeakingGameState {
  const scorerRef = useRef<LiveScorer | null>(null)
  const processedCountRef = useRef(0)
  const lastWordTimeRef = useRef<number | null>(null)
  const [wordStates, setWordStates] = useState<WordState[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [displayIndex, setDisplayIndex] = useState(0)
  const [streak, setStreak] = useState(0)
  const [height, setHeight] = useState(0)
  const [liveWpm, setLiveWpm] = useState(0)
  const [events, setEvents] = useState<GameEvent[]>([])
  const [rawWpms, setRawWpms] = useState<number[]>([])

  // Reset scorer when prompt changes or test becomes inactive
  useEffect(() => {
    if (!isActive) {
      scorerRef.current = null
      processedCountRef.current = 0
      lastWordTimeRef.current = null
      setRawWpms([])
      setWordStates([])
      setCurrentIndex(0)
      setPreviewIndex(0)
      setDisplayIndex(0)
      setStreak(0)
      setHeight(0)
      setLiveWpm(0)
      setEvents([])
      return
    }

    if (!scorerRef.current) {
      scorerRef.current = new LiveScorer(prompt)
      processedCountRef.current = 0
      lastWordTimeRef.current = startedAt
      setRawWpms([])
      const snap = scorerRef.current.snapshot()
      setWordStates(snap.wordStates)
      setCurrentIndex(snap.currentIndex)
      setPreviewIndex(snap.currentIndex)
      setDisplayIndex(snap.currentIndex)
    }
  }, [isActive, prompt, startedAt])

  // Process newly confirmed words
  useEffect(() => {
    if (!isActive || !scorerRef.current) return

    const newWords = confirmedWords.slice(processedCountRef.current)
    if (newWords.length === 0) return

    const now = Date.now()
    const newSamples: number[] = []
    for (const word of newWords) {
      if (lastWordTimeRef.current && startedAt) {
        const gapSec = (now - lastWordTimeRef.current) / 1000
        if (gapSec > 0.05) {
          const chars = word.length + 1
          newSamples.push(rawWpmFromChars(chars, gapSec))
        }
      }
      lastWordTimeRef.current = now
    }
    if (newSamples.length > 0) {
      setRawWpms((prev) => [...prev, ...newSamples])
    }

    const snap = scorerRef.current.processWords(newWords)
    processedCountRef.current = confirmedWords.length

    setWordStates(snap.wordStates)
    setCurrentIndex(snap.currentIndex)
    setPreviewIndex((prev) => Math.max(prev, snap.currentIndex))
    setDisplayIndex((prev) => Math.max(prev, snap.currentIndex))
    setStreak(snap.streak)
    setHeight(snap.height)
    setEvents(scorerRef.current.drainEvents())
  }, [confirmedWords, isActive, startedAt])

  useEffect(() => {
    if (!isActive) return

    if (previewWords.length === 0) {
      setPreviewIndex((prev) => Math.max(prev, currentIndex))
      setDisplayIndex((prev) => Math.max(prev, currentIndex))
      return
    }

    const nextPreviewIndex = computeInterimDissolveIndex(previewWords, prompt, currentIndex)
    setPreviewIndex((prev) => Math.max(prev, currentIndex, nextPreviewIndex))
    setDisplayIndex((prev) => Math.max(prev, currentIndex, nextPreviewIndex))
  }, [previewWords, prompt, currentIndex, isActive])

  // Live WPM ticker
  useEffect(() => {
    if (!isActive || !startedAt) {
      setLiveWpm(0)
      return
    }
    const tick = () => {
      const elapsed = (Date.now() - startedAt) / 1000
      const chars = confirmedWords.reduce((sum, w) => sum + w.length + 1, 0)
      setLiveWpm(elapsed < 0.5 ? 0 : netWpmFromChars(chars, elapsed))
    }
    tick()
    const id = window.setInterval(tick, 400)
    return () => window.clearInterval(id)
  }, [isActive, startedAt, confirmedWords])

  const liveAccuracy = useMemo(() => {
    if (!isActive || prompt.length === 0) return 0
    const resolved = wordStates.filter((s) => s === 'correct' || s === 'incorrect').length
    if (resolved === 0) return 0
    const correct = wordStates.filter((s) => s === 'correct').length
    return Math.round((correct / resolved) * 100)
  }, [isActive, prompt.length, wordStates])

  return {
    wordStates,
    currentIndex,
    previewIndex,
    displayIndex,
    streak,
    height,
    liveWpm,
    liveAccuracy,
    events,
    rawWpms,
  }
}
