'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { buildPingPongCols } from '@/lib/spriteUtils'

const FRAME_X = ['0%', '25%', '50%', '75%', '100%']
const IDLE_SEQ = buildPingPongCols([0, 1, 2, 3, 4])
const IDLE_STEP = 0.34

interface HeroMonkeyProps {
  onStart: () => void
  micState: 'idle' | 'requesting' | 'active' | 'denied' | 'error'
  onHoverChange?: (hovered: boolean) => void
}

export default function HeroMonkey({ onStart, micState, onHoverChange }: HeroMonkeyProps) {
  const wrapRef    = useRef<HTMLDivElement>(null)
  const mascotRef  = useRef<HTMLDivElement>(null)
  const spriteRef  = useRef<HTMLDivElement>(null)
  const btnRef     = useRef<HTMLButtonElement>(null)
  const ctxRef     = useRef<gsap.Context | null>(null)
  const frameCtxRef = useRef<gsap.Context | null>(null)
  const reducedRef = useRef(false)

  const isDenied  = micState === 'denied' || micState === 'error'
  const isLoading = micState === 'requesting'

  const setFrame = (col: number) => {
    if (spriteRef.current) spriteRef.current.style.backgroundPositionX = FRAME_X[col] ?? '0%'
  }

  const startSlowMicLoop = () => {
    frameCtxRef.current?.revert()
    frameCtxRef.current = null

    if (reducedRef.current) {
      setFrame(2)
      return
    }

    frameCtxRef.current = gsap.context(() => {
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.35 })
      for (const col of IDLE_SEQ) {
        tl.call(() => setFrame(col))
        tl.to({}, { duration: IDLE_STEP })
      }
    })
  }

  /* ── mount: entrance + bob ── */
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
        startSlowMicLoop()
      })
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        reducedRef.current = false
        gsap.to(mascotRef.current, {
          y: -5,
          rotate: 1.2,
          duration: 3.2,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          delay: 1.05,
        })
        startSlowMicLoop()
      })
    }, wrapRef)

    return () => {
      ctxRef.current?.revert()
      frameCtxRef.current?.revert()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── interaction handlers ── */
  const handleEnter = () => {
    onHoverChange?.(true)
    if (!reducedRef.current) {
      gsap.to(btnRef.current, { scale: 1.08, duration: 0.18, ease: 'power2.out' })
      gsap.to(mascotRef.current, { y: -8, rotate: -1.5, duration: 0.35, ease: 'power2.out' })
    }
  }

  const handleLeave = () => {
    onHoverChange?.(false)
    if (!reducedRef.current) {
      gsap.to(btnRef.current, { scale: 1, duration: 0.18, ease: 'power2.out' })
      gsap.to(mascotRef.current, { y: 0, rotate: 0, duration: 0.45, ease: 'power2.out' })
    }
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
        <div
          ref={mascotRef}
          className="hero-monkey-mascot"
          aria-hidden
        >
          <div ref={spriteRef} className="hero-monkey-sprite" />

          {isLoading && (
            <div className="hero-monkey-overlay">
              <svg className="animate-spin" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
              </svg>
            </div>
          )}
        </div>

        <button
          ref={btnRef}
          type="button"
          onClick={handleClick}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          onFocus={handleEnter}
          onBlur={handleLeave}
          disabled={isLoading || isDenied}
          aria-label="Start speaking"
          className="hero-start-btn"
          data-denied={isDenied ? 'true' : 'false'}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <path d="M12 19v3" />
            <path d="M8 22h8" />
          </svg>
          <span>{isLoading ? 'starting...' : 'STAAARTT??'}</span>
        </button>

        <p className="hero-footer-tagline font-mono">
          No signup. Just you and your voice. <span aria-hidden>♥</span>
        </p>

        {isDenied && (
          <p className="hero-monkey-error-badge font-mono">
            mic blocked — check browser permissions
          </p>
        )}
      </div>
    </div>
  )
}
