'use client'

import { useEffect, useRef, useCallback } from 'react'
import { gsap } from 'gsap'

interface DissolveTextProps {
  words: string[]
  dissolvedCount: number
}

export default function DissolveText({ words, dissolvedCount }: DissolveTextProps) {
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
  }, [measureLines, dissolvedCount])

  // Animate dissolve on newly consumed words
  useEffect(() => {
    for (let i = 0; i < dissolvedCount; i++) {
      const el = wordRefsMap.current.get(i)
      if (!el || el.dataset.dissolved === '1') continue
      el.dataset.dissolved = '1'
      gsap.to(el, {
        opacity: 0.25,
        filter: 'blur(1px)',
        duration: 0.5,
        ease: 'power2.out',
      })
    }
  }, [dissolvedCount])

  // Scroll window as current line advances
  useEffect(() => {
    let lineOf = lineOfIndexRef.current
    if (lineOf.length === 0) { measureLines(); lineOf = lineOfIndexRef.current }
    if (lineOf.length === 0 || !containerRef.current) return

    const idx = Math.min(dissolvedCount, words.length - 1)
    const currentLine =
      dissolvedCount >= words.length
        ? lineOf[lineOf.length - 1]! + 1
        : lineOf[idx] ?? 0
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
  }, [dissolvedCount, words.length, measureLines])

  return (
    <div className="dissolve-text-viewport" aria-label="Speaking prompt" aria-live="polite">
      <div ref={containerRef} className="dissolve-text select-none">
        {words.map((word, i) => {
          const isDissolved = i < dissolvedCount
          const isCurrent = i === dissolvedCount

          let color = 'var(--text-muted)'
          let fontWeight = 400
          let opacity = 1

          if (isDissolved) {
            color = 'var(--text-stats)'
            opacity = 0.3
            fontWeight = 400
          } else if (isCurrent) {
            color = 'var(--accent)'
            fontWeight = 700
          }

          return (
            <span
              key={`${i}-${word}`}
              ref={setWordRef(i)}
              className={`dissolve-word ${isCurrent ? 'dissolve-word--current' : ''}`}
              style={{ color, fontWeight, opacity }}
            >
              {word}
              {isCurrent && (
                <span className="dissolve-word-underline" aria-hidden />
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
}
