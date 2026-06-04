'use client'

import { useEffect, useRef, useCallback } from 'react'
import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'
import type { CSSProperties } from 'react'

gsap.registerPlugin(Flip)

interface TestAreaProps {
  words: string[]
  dissolvedCount: number
  isActive: boolean
}

/** Lines shown in the viewport during an active test */
const ACTIVE_VISIBLE_LINES = 3

export default function TestArea({ words, dissolvedCount, isActive }: TestAreaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const wordRefsMap = useRef<Map<number, HTMLSpanElement>>(new Map())
  const underlineTweenRef = useRef<gsap.core.Tween | null>(null)
  const underlineRef = useRef<HTMLSpanElement | null>(null)
  const lineOfIndexRef = useRef<number[]>([])
  const lineCountRef = useRef(0)
  const prevLineRef = useRef(0)

  const setWordRef = useCallback((index: number) => (el: HTMLSpanElement | null) => {
    if (el) {
      wordRefsMap.current.set(index, el)
    } else {
      wordRefsMap.current.delete(index)
    }
  }, [])

  // Group word spans into visual (wrap) lines by their vertical offset.
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
    lineCountRef.current = lineIdx + 1
  }, [words])

  // Reset scroll and dissolved state when prompt changes or test becomes idle
  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.style.transform = 'translateY(0)'
    containerRef.current.style.transition = 'none'
    prevLineRef.current = 0
    lineOfIndexRef.current = []
    // Restore visibility for all words (e.g. on retry)
    wordRefsMap.current.forEach((el) => {
      el.style.visibility = ''
      el.style.position = ''
      el.style.opacity = '1'
      el.style.filter = ''
      el.style.transform = ''
    })
  }, [words])

  // Measure visual lines once the test is active (and re-measure on resize
  // before any line has dusted away, since layout is stable until then).
  useEffect(() => {
    if (!isActive) return
    const id = requestAnimationFrame(measureLines)
    const onResize = () => { if (prevLineRef.current === 0) measureLines() }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', onResize)
    }
  }, [isActive, measureLines])

  // Dust away a whole line once its last word has been spoken, then slide the
  // remaining lines up into reading position.
  useEffect(() => {
    if (!isActive) return
    let lineOf = lineOfIndexRef.current
    if (lineOf.length === 0) { measureLines(); lineOf = lineOfIndexRef.current }
    if (lineOf.length === 0) return

    const prevLine = prevLineRef.current
    const currentLine = dissolvedCount >= words.length
      ? lineCountRef.current
      : lineOf[Math.min(dissolvedCount, words.length - 1)]
    if (currentLine <= prevLine) return
    prevLineRef.current = currentLine

    const container = containerRef.current
    if (!container) return

    // Survivors = words on lines still ahead of the reading position
    const survivors: HTMLSpanElement[] = []
    for (let i = 0; i < words.length; i++) {
      if (lineOf[i] >= currentLine) {
        const el = wordRefsMap.current.get(i)
        if (el) survivors.push(el)
      }
    }
    const state = Flip.getState(survivors)

    // Dust every word on the completed line(s) [prevLine, currentLine)
    let order = 0
    for (let i = 0; i < words.length; i++) {
      if (lineOf[i] >= prevLine && lineOf[i] < currentLine) {
        const el = wordRefsMap.current.get(i)
        if (!el) continue
        el.style.position = 'absolute' // pin at static spot so survivors can rise
        gsap.to(el, {
          opacity: 0,
          filter: 'blur(6px)',
          y: -12,
          scale: 0.96,
          duration: 0.45,
          ease: 'power2.in',
          delay: order * 0.04,
          onComplete: () => {
            el.style.visibility = 'hidden'
          },
        })
        order++
      }
    }

    // Slide the remaining lines up smoothly
    Flip.from(state, {
      duration: 0.45,
      ease: 'power2.out',
    })
  }, [dissolvedCount, isActive, words.length, measureLines])

  // Current word underline pulse
  useEffect(() => {
    if (!isActive) {
      underlineTweenRef.current?.kill()
      underlineTweenRef.current = null
      return
    }
    const el = underlineRef.current
    if (!el) return

    underlineTweenRef.current?.kill()
    underlineTweenRef.current = gsap.to(el, {
      opacity: 1,
      keyframes: [
        { opacity: 0.4, duration: 0.3 },
        { opacity: 1, duration: 0.3 },
        { opacity: 0.4, duration: 0.3 },
      ],
      repeat: -1,
      ease: 'sine.inOut',
    })

    return () => {
      underlineTweenRef.current?.kill()
      underlineTweenRef.current = null
    }
  }, [dissolvedCount, isActive])

  const testTextStyles: CSSProperties = {
    fontFamily: 'var(--font-mono), ui-monospace, monospace',
    fontSize: 'var(--test-font-size)',
    lineHeight: 'var(--test-line-height)',
  }

  return (
    <div className="flex flex-col gap-4 items-stretch w-full">
      <div
        style={{
          maxWidth: '100%',
          ...(isActive
            ? {
                maxHeight: `calc(${ACTIVE_VISIBLE_LINES} * var(--test-line-height))`,
                overflow: 'hidden',
                paddingBottom: 4,
              }
            : {
                ...testTextStyles,
                maxHeight: `calc(${ACTIVE_VISIBLE_LINES} * var(--test-line-height))`,
                overflow: 'hidden',
              }),
        }}
        aria-label="Speaking prompt"
        aria-live="polite"
      >
        <div
          ref={containerRef}
          className="select-none w-full text-left"
          style={isActive ? testTextStyles : {}}
        >
          {words.map((word, i) => {
            const isCurrent = isActive && i === dissolvedCount
            const isDissolved = isActive && i < dissolvedCount

            const color = !isActive
              ? i === 0
                ? 'var(--accent)'
                : 'var(--text-muted)'
              : isDissolved
                ? 'var(--text-muted)'
                : isCurrent
                  ? 'var(--accent)'
                  : 'var(--text-active)'

            return (
              <span
                key={`${i}-${word}`}
                ref={isActive ? setWordRef(i) : undefined}
                style={{
                  display: 'inline-block',
                  marginRight: '0.45em',
                  position: 'relative',
                  color,
                  fontWeight: isCurrent ? 500 : 400,
                  transition: 'color 0.25s ease',
                }}
              >
                {word}

                {isCurrent && (
                  <span
                    ref={underlineRef}
                    style={{
                      position: 'absolute',
                      bottom: 2,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: 'var(--accent)',
                      borderRadius: 1,
                      opacity: 0.4,
                    }}
                    aria-hidden
                  />
                )}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
