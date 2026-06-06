'use client'

import { useEffect, useRef, useCallback } from 'react'
import { gsap } from 'gsap'
import type { WordState } from '@/lib/liveAlign'

interface ReadingTextProps {
  words: string[]
  wordStates: WordState[]
  currentIndex: number
}

const ACTIVE_VISIBLE_LINES = 3

function stateColor(state: WordState): string {
  switch (state) {
    case 'correct': return 'var(--success)'
    case 'incorrect': return 'var(--error)'
    case 'current': return 'var(--accent)'
    default: return 'var(--text-muted)'
  }
}

export default function ReadingText({ words, wordStates, currentIndex }: ReadingTextProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wordRefsMap = useRef<Map<number, HTMLSpanElement>>(new Map())
  const lineOfIndexRef = useRef<number[]>([])
  const prevLineRef = useRef(0)

  const setWordRef = useCallback((index: number) => (el: HTMLSpanElement | null) => {
    if (el) wordRefsMap.current.set(index, el)
    else wordRefsMap.current.delete(index)
  }, [])

  const measureLines = useCallback(() => {
    const map: number[] = []
    let lineIdx = -1
    let lastTop = Number.NEGATIVE_INFINITY
    for (let i = 0; i < words.length; i++) {
      const el = wordRefsMap.current.get(i)
      if (!el) { map[i] = Math.max(lineIdx, 0); continue }
      const top = el.offsetTop
      if (top > lastTop + 1) { lineIdx++; lastTop = top }
      map[i] = lineIdx
    }
    lineOfIndexRef.current = map
  }, [words])

  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.style.transform = 'translateY(0)'
    prevLineRef.current = 0
    lineOfIndexRef.current = []
  }, [words])

  useEffect(() => {
    const id = requestAnimationFrame(measureLines)
    const onResize = () => measureLines()
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', onResize)
    }
  }, [measureLines, wordStates])

  // Scroll window as current line advances
  useEffect(() => {
    let lineOf = lineOfIndexRef.current
    if (lineOf.length === 0) { measureLines(); lineOf = lineOfIndexRef.current }
    if (lineOf.length === 0 || !containerRef.current) return

    const idx = Math.min(currentIndex, words.length - 1)
    const currentLine = currentIndex >= words.length ? lineOf[lineOf.length - 1]! + 1 : lineOf[idx] ?? 0
    const prevLine = prevLineRef.current
    if (currentLine <= prevLine) return
    prevLineRef.current = currentLine

    const firstWordOnLine = lineOf.findIndex((l) => l === currentLine)
    if (firstWordOnLine < 0) return
    const el = wordRefsMap.current.get(firstWordOnLine)
    if (!el) return

    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 44
    const offset = Math.max(0, (currentLine - 1) * lineHeight)
    gsap.to(containerRef.current, { y: -offset, duration: 0.45, ease: 'power2.out' })
  }, [currentIndex, words.length, measureLines])

  return (
    <div
      className="game-reading-viewport"
      aria-label="Speaking prompt"
      aria-live="polite"
    >
      <div ref={containerRef} className="game-reading-text select-none">
        {words.map((word, i) => {
          const state = wordStates[i] ?? (i === 0 ? 'current' : 'pending')
          const isCurrent = state === 'current'

          return (
            <span
              key={`${i}-${word}`}
              ref={setWordRef(i)}
              className={`game-word game-word--${state}`}
              style={{
                color: stateColor(state),
                fontWeight: isCurrent ? 700 : state === 'correct' ? 600 : 400,
              }}
            >
              {word}
            </span>
          )
        })}
      </div>
    </div>
  )
}
