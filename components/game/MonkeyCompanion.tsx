'use client'

import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import type { CompanionState } from '@/hooks/useVoiceActivity'

interface MonkeyCompanionProps {
  state: CompanionState
  energy: number
  momentum: number
}

export default function MonkeyCompanion({ state, energy, momentum }: MonkeyCompanionProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bobTweenRef = useRef<gsap.core.Tween | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    bobTweenRef.current?.kill()

    const ctx = gsap.context(() => {
      gsap.killTweensOf(el)

      switch (state) {
        case 'celebrating':
          gsap.to(el, {
            rotation: 12,
            scale: 1.12,
            duration: 0.25,
            ease: 'back.out(2)',
            yoyo: true,
            repeat: 5,
          })
          break
        case 'excited':
          bobTweenRef.current = gsap.to(el, {
            y: -10,
            scale: 1.06,
            duration: 0.35,
            ease: 'power2.out',
            yoyo: true,
            repeat: -1,
          })
          break
        case 'speaking':
          bobTweenRef.current = gsap.to(el, {
            y: -6,
            duration: 0.5,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
          })
          break
        case 'listening':
          gsap.to(el, { rotation: 4, duration: 0.6, ease: 'sine.inOut', yoyo: true, repeat: -1 })
          break
        case 'sleepy':
          bobTweenRef.current = gsap.to(el, {
            y: 4,
            rotation: -3,
            duration: 2,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
          })
          break
        case 'idle':
        default:
          bobTweenRef.current = gsap.to(el, {
            y: -3,
            duration: 1.4,
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

  const mouthOpen = state === 'speaking' || state === 'excited' || state === 'celebrating'
  const mouthYawn = state === 'sleepy'
  const eyesDroopy = state === 'sleepy'
  const eyesWide = state === 'listening' || state === 'excited'
  const smile = state === 'speaking' || state === 'excited' || state === 'celebrating'

  return (
    <div
      ref={containerRef}
      className="monkey-companion"
      aria-hidden
      style={{
        filter: momentum > 50
          ? `brightness(${1 + momentum * 0.003})`
          : undefined,
      }}
    >
      {state === 'celebrating' && (
        <div className="monkey-confetti" aria-hidden>
          <span /><span /><span /><span /><span />
        </div>
      )}
      <svg width="72" height="72" viewBox="0 0 64 64" className="monkey-companion-svg">
        {/* Ears */}
        <circle cx="20" cy="28" r="10" fill="#c4956a" stroke="var(--border)" strokeWidth="2" />
        <circle cx="44" cy="28" r="10" fill="#c4956a" stroke="var(--border)" strokeWidth="2" />
        {/* Head */}
        <rect x="14" y="24" width="36" height="32" fill="#e8c9a0" stroke="var(--border)" strokeWidth="2" />
        {/* Face */}
        <rect x="18" y="32" width="28" height="22" fill="#d4a574" stroke="var(--border)" strokeWidth="1.5" />
        {/* Eyes */}
        {eyesDroopy ? (
          <>
            <path d="M24 38 Q26 42 28 38" stroke="var(--border)" strokeWidth="2" fill="none" />
            <path d="M36 38 Q38 42 40 38" stroke="var(--border)" strokeWidth="2" fill="none" />
          </>
        ) : (
          <>
            <ellipse
              cx="26"
              cy="40"
              rx={eyesWide ? 5 : 4}
              ry={eyesWide ? 5 : 4}
              fill="var(--border)"
            />
            <ellipse
              cx="38"
              cy="40"
              rx={eyesWide ? 5 : 4}
              ry={eyesWide ? 5 : 4}
              fill="var(--border)"
            />
            {eyesWide && (
              <>
                <circle cx="27" cy="39" r="1.5" fill="#fff" />
                <circle cx="39" cy="39" r="1.5" fill="#fff" />
              </>
            )}
          </>
        )}
        {/* Mouth */}
        {mouthYawn ? (
          <ellipse cx="32" cy="50" rx="8" ry="5" fill="#c4956a" stroke="var(--border)" strokeWidth="1.5" />
        ) : mouthOpen ? (
          smile ? (
            <path d="M26 48 Q32 54 38 48" stroke="var(--border)" strokeWidth="2" fill="none" />
          ) : (
            <ellipse cx="32" cy="50" rx="5" ry="4" fill="#c4956a" stroke="var(--border)" strokeWidth="1.5" />
          )
        ) : (
          <path d="M28 48 Q32 50 36 48" stroke="var(--border)" strokeWidth="1.5" fill="none" />
        )}
        {/* Body hint */}
        <rect x="20" y="54" width="24" height="8" fill="#d4a574" stroke="var(--border)" strokeWidth="1.5" />
      </svg>
      {state === 'celebrating' && (
        <span className="monkey-thumbs-up" aria-hidden>👍</span>
      )}
      {energy > 0.2 && state !== 'sleepy' && state !== 'idle' && (
        <div className="monkey-energy-glow" style={{ opacity: energy * 0.6 }} />
      )}
    </div>
  )
}
