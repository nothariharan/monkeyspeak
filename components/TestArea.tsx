'use client'

import { useEffect, useRef, useCallback } from 'react'
import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'
import type { CSSProperties } from 'react'
import WaveformVisualiser from '@/components/WaveformVisualiser'

gsap.registerPlugin(Flip)

interface TestAreaProps {
  words: string[]
  dissolvedCount: number
  isActive: boolean
  micStream?: MediaStream | null
  hasSttError?: boolean
  timeRemainingMs?: number
}

const ACTIVE_VISIBLE_LINES = 3

function formatTimer(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function TestArea({
  words,
  dissolvedCount,
  isActive,
  micStream = null,
  hasSttError = false,
  timeRemainingMs = 0,
}: TestAreaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const wordRefsMap = useRef<Map<number, HTMLSpanElement>>(new Map())
  const underlineTweenRef = useRef<gsap.core.Tween | null>(null)
  const underlineRef = useRef<HTMLSpanElement | null>(null)
  const lineOfIndexRef = useRef<number[]>([])
  const lineCountRef = useRef(0)
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
    lineCountRef.current = lineIdx + 1
  }, [words])

  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.style.transform = 'translateY(0)'
    containerRef.current.style.transition = 'none'
    prevLineRef.current = 0
    lineOfIndexRef.current = []
    wordRefsMap.current.forEach((el) => {
      el.style.visibility = ''
      el.style.position = ''
      el.style.opacity = '1'
      el.style.filter = ''
      el.style.transform = ''
    })
  }, [words])

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

    const survivors: HTMLSpanElement[] = []
    for (let i = 0; i < words.length; i++) {
      if (lineOf[i] >= currentLine) {
        const el = wordRefsMap.current.get(i)
        if (el) survivors.push(el)
      }
    }
    const state = Flip.getState(survivors)

    let order = 0
    for (let i = 0; i < words.length; i++) {
      if (lineOf[i] >= prevLine && lineOf[i] < currentLine) {
        const el = wordRefsMap.current.get(i)
        if (!el) continue
        el.style.position = 'absolute'
        gsap.to(el, {
          opacity: 0,
          filter: 'blur(6px)',
          y: -12,
          scale: 0.96,
          duration: 0.45,
          ease: 'power2.in',
          delay: order * 0.04,
          onComplete: () => { el.style.visibility = 'hidden' },
        })
        order++
      }
    }

    Flip.from(state, { duration: 0.45, ease: 'power2.out' })
  }, [dissolvedCount, isActive, words.length, measureLines])

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

  const content = (
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
        className="select-none w-full text-center"
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
              ? 'var(--success)'
              : isCurrent
                ? 'var(--accent)'
                : 'var(--text-muted)'

          return (
            <span
              key={`${i}-${word}`}
              ref={isActive ? setWordRef(i) : undefined}
              className={isDissolved ? 'word correct' : isCurrent ? 'word current' : 'word unspoken'}
              style={{
                display: 'inline-block',
                marginRight: '0.45em',
                position: 'relative',
                color,
                fontWeight: isCurrent ? 700 : isDissolved ? 600 : 400,
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
                    height: 3,
                    background: 'var(--accent)',
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
  )

  if (!isActive) {
    return (
      <div className="flex flex-col gap-4 items-stretch w-full">
        {content}
      </div>
    )
  }

  return (
    <div className="clean-card w-full flex flex-col gap-0 overflow-hidden">
      {/* Live status bar */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '3px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="font-display text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--success)' }}>
            Live
          </span>
        </div>
        {timeRemainingMs > 0 && (
          <span
            className="font-display text-sm font-black tabular-nums"
            style={{ color: 'var(--text-active)' }}
          >
            {formatTimer(timeRemainingMs)}
          </span>
        )}
      </div>

      <div className="px-6 py-8 flex flex-col items-center gap-6">
        {content}

        {/* Listening pill */}
        <div className="clean-pill clean-pill-live">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Listening…
        </div>
      </div>

      <WaveformVisualiser
        stream={micStream}
        isActive={isActive}
        hasError={hasSttError}
        embedded
      />
    </div>
  )
}
