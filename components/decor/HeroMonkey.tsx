'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { buildPingPongCols } from '@/lib/spriteUtils'

const FRAME_X = ['0%', '25%', '50%', '75%', '100%']
const BG_Y = '53%'

const IDLE_SEQ  = buildPingPongCols([0, 1, 2, 3, 4])
const HOVER_SEQ = [1, 2, 3, 4, 3, 2, 1, 0]
const IDLE_STEP  = 2.4 / IDLE_SEQ.length
const HOVER_STEP = 1.0 / HOVER_SEQ.length

interface HeroMonkeyProps {
  onStart: () => void
  micState: 'idle' | 'requesting' | 'active' | 'denied' | 'error'
  onHoverChange?: (hovered: boolean) => void
}

export default function HeroMonkey({ onStart, micState, onHoverChange }: HeroMonkeyProps) {
  const wrapRef    = useRef<HTMLDivElement>(null)
  const btnRef     = useRef<HTMLButtonElement>(null)
  const spriteRef  = useRef<HTMLDivElement>(null)
  const ctxRef     = useRef<gsap.Context | null>(null)
  const frameCtxRef = useRef<gsap.Context | null>(null)
  const reducedRef = useRef(false)
  const [hovered, setHovered] = useState(false)

  const isDenied  = micState === 'denied' || micState === 'error'
  const isLoading = micState === 'requesting'

  /* ── paint one sprite frame ── */
  const setFrame = (col: number) => {
    if (spriteRef.current) spriteRef.current.style.backgroundPositionX = FRAME_X[col] ?? '0%'
  }

  /* ── start/restart the frame loop ── */
  const startLoop = (isHovered: boolean) => {
    frameCtxRef.current?.revert()
    frameCtxRef.current = null

    if (reducedRef.current) { setFrame(2); return }

    const seq  = isHovered ? HOVER_SEQ : IDLE_SEQ
    const step = isHovered ? HOVER_STEP : IDLE_STEP

    frameCtxRef.current = gsap.context(() => {
      const tl = gsap.timeline({ repeat: -1 })
      for (const col of seq) {
        tl.call(() => setFrame(col))
        tl.to({}, { duration: step })
      }
    })
  }

  /* ── mount: entrance + bob + initial frame loop ── */
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    ctxRef.current = gsap.context(() => {
      /* entrance */
      gsap.from(wrap, {
        y: 38,
        opacity: 0,
        scale: 0.88,
        duration: 0.8,
        ease: 'power3.out',
        delay: 0.2,
        clearProps: 'opacity,scale',   /* remove inline opacity/scale after tween */
      })

      /* bob — only when user hasn't requested reduced motion */
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: reduce)', () => {
        reducedRef.current = true
        startLoop(false)
      })
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        reducedRef.current = false
        gsap.to(wrap, {
          y: -9,
          duration: 2.5,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          delay: 1.05,
        })
        startLoop(false)
      })
    }, wrapRef)

    return () => {
      ctxRef.current?.revert()
      frameCtxRef.current?.revert()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── restart frame loop on hover change ── */
  useEffect(() => {
    startLoop(hovered)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered])

  /* ── interaction handlers ── */
  const handleEnter = () => {
    setHovered(true)
    onHoverChange?.(true)
    if (btnRef.current && !reducedRef.current)
      gsap.to(btnRef.current, { scale: 1.08, duration: 0.18, ease: 'power2.out' })
  }

  const handleLeave = () => {
    setHovered(false)
    onHoverChange?.(false)
    if (btnRef.current && !reducedRef.current)
      gsap.to(btnRef.current, { scale: 1, duration: 0.18, ease: 'power2.out' })
  }

  const handleClick = () => {
    if (isDenied || isLoading) return
    if (btnRef.current && !reducedRef.current)
      gsap.fromTo(btnRef.current, { scale: 0.93 }, { scale: 1, duration: 0.35, ease: 'back.out(2)' })
    onStart()
  }

  return (
    <div className="hero-monkey-stage">
      <div ref={wrapRef} className="hero-monkey-wrap">

        {!isDenied && !isLoading && <span className="hero-monkey-ring" aria-hidden />}

        <button
          ref={btnRef}
          type="button"
          onClick={handleClick}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          onFocus={handleEnter}
          onBlur={handleLeave}
          disabled={isLoading || isDenied}
          aria-label="Click to start speaking"
          className="hero-monkey-btn"
          data-denied={isDenied ? 'true' : 'false'}
        >
          <div className="hero-monkey-circle">
            {/* Sprite — background-position driven by GSAP */}
            <div ref={spriteRef} className="hero-monkey-sprite" />

            {isLoading && (
              <div className="hero-monkey-overlay">
                <svg className="animate-spin" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                </svg>
              </div>
            )}
          </div>
        </button>

        {!isDenied && !isLoading && (
          <div className="hero-monkey-callout" aria-hidden>
            <svg className="hero-monkey-callout-arrow" viewBox="0 0 52 44" fill="none">
              <path d="M46 6 Q34 3 23 15 Q14 25 16 39" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" fill="none" strokeDasharray="4 4" />
              <path d="M10 37 L16 41 L20 34" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
            <span className="hero-monkey-callout-label font-display">
              {hovered ? 'yes, click me!' : 'click to speak'}
            </span>
          </div>
        )}

        {isDenied && (
          <p className="hero-monkey-error-badge font-mono">
            mic blocked — check browser permissions
          </p>
        )}
      </div>
    </div>
  )
}
