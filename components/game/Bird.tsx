'use client'

import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'

export type BirdState = 'idle' | 'rise' | 'fall' | 'boost' | 'celebrate'

interface BirdProps {
  state: BirdState
  streak: number
}

export default function Bird({ state, streak }: BirdProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bobTweenRef = useRef<gsap.core.Tween | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    bobTweenRef.current?.kill()

    const ctx = gsap.context(() => {
      switch (state) {
        case 'rise':
          gsap.to(el, { y: -8, duration: 0.25, ease: 'power2.out', yoyo: true, repeat: 1 })
          break
        case 'fall':
          gsap.to(el, { y: 6, duration: 0.3, ease: 'power2.in' })
          gsap.to(el, { x: '+=3', duration: 0.05, yoyo: true, repeat: 5 })
          break
        case 'boost':
          gsap.to(el, { scale: 1.15, duration: 0.15, ease: 'power2.out', yoyo: true, repeat: 1 })
          break
        case 'celebrate':
          gsap.to(el, { rotation: 15, duration: 0.2, ease: 'back.out(2)', yoyo: true, repeat: 3 })
          break
        case 'idle':
        default:
          bobTweenRef.current = gsap.to(el, {
            y: -4,
            duration: 1.2,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
          })
          break
      }
    }, containerRef)

    return () => {
      bobTweenRef.current?.kill()
      ctx.revert()
    }
  }, [state])

  const showSpeedLines = streak >= 25

  return (
    <div ref={containerRef} className="game-bird" aria-hidden>
      {showSpeedLines && (
        <div className="game-speed-lines">
          <span /><span /><span />
        </div>
      )}
      <svg width="32" height="28" viewBox="0 0 32 28" className="game-bird-svg">
        {/* Body */}
        <rect x="10" y="10" width="14" height="12" fill="var(--accent)" stroke="var(--border)" strokeWidth="1.5" />
        {/* Head */}
        <rect x="18" y="6" width="10" height="8" fill="var(--accent)" stroke="var(--border)" strokeWidth="1.5" />
        {/* Beak */}
        <polygon points="28,10 32,12 28,14" fill="#f97316" stroke="var(--border)" strokeWidth="1" />
        {/* Eye */}
        <rect x="22" y="9" width="3" height="3" fill="var(--border)" />
        {/* Wing */}
        <rect x="8" y="12" width="8" height="6" fill="color-mix(in srgb, var(--accent) 70%, #fff)" stroke="var(--border)" strokeWidth="1" />
        {/* Tail */}
        <polygon points="6,14 10,12 10,18" fill="var(--accent)" stroke="var(--border)" strokeWidth="1" />
      </svg>
      {streak >= 10 && <div className="game-bird-glow" />}
    </div>
  )
}
