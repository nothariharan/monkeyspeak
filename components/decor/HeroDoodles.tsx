'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

interface HeroDoodlesProps {
  micHovered?: boolean
}

export default function HeroDoodles({ micHovered = false }: HeroDoodlesProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from(root.querySelectorAll('.hero-doodle'), {
        opacity: 0,
        scale: 0.85,
        y: 12,
        stagger: 0.08,
        duration: 0.55,
        ease: 'power2.out',
        delay: 0.15,
      })

      root.querySelectorAll('.hero-doodle--float').forEach((el, i) => {
        gsap.to(el, {
          y: i % 2 === 0 ? -8 : 8,
          x: i % 2 === 0 ? 4 : -4,
          duration: 2.8 + i * 0.3,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          delay: i * 0.2,
        })
      })
    })

    return () => mm.revert()
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    root.dataset.energized = micHovered ? 'true' : 'false'
  }, [micHovered])

  return (
    <div ref={rootRef} className="hero-doodles" aria-hidden>
      {/* Waveform — left */}
      <svg className="hero-doodle hero-doodle--wave hero-doodle--float" viewBox="0 0 80 32" fill="none">
        <path
          d="M2 16 L10 8 L18 24 L26 6 L34 26 L42 12 L50 20 L58 10 L66 22 L74 14"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Lightning accent */}
      <svg className="hero-doodle hero-doodle--bolt hero-doodle--float" viewBox="0 0 24 32" fill="none">
        <path
          d="M14 2 L6 18 H12 L10 30 L20 12 H14 Z"
          fill="var(--orange)"
          stroke="var(--border)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>

      {/* Speech bubble */}
      <div className="hero-doodle hero-doodle--bubble hero-doodle--float">
        <span>speak!</span>
      </div>

      {/* Quote marks */}
      <span className="hero-doodle hero-doodle--quote hero-doodle--float">&ldquo;</span>
      <span className="hero-doodle hero-doodle--quote hero-doodle--quote-right hero-doodle--float">&rdquo;</span>

      {/* Curved line toward mic */}
      <svg className="hero-doodle hero-doodle--curve" viewBox="0 0 60 50" fill="none">
        <path
          d="M8 42 Q30 8 52 20"
          stroke="var(--text-stats)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="4 6"
        />
        <path d="M46 16 L52 20 L48 26" stroke="var(--text-stats)" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>

      {/* Mic hint glyph */}
      <svg className="hero-doodle hero-doodle--mic-glyph hero-doodle--float" viewBox="0 0 20 28" fill="none">
        <rect x="7" y="2" width="6" height="11" rx="3" fill="var(--accent)" opacity="0.85" />
        <path d="M3 12a7 7 0 0 0 14 0" stroke="var(--accent)" strokeWidth="1.5" fill="none" />
        <line x1="10" y1="19" x2="10" y2="24" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      {/* Spark dots */}
      <span className="hero-doodle hero-doodle--spark hero-doodle--float">✦</span>
      <span className="hero-doodle hero-doodle--spark hero-doodle--spark-2 hero-doodle--float">✦</span>
    </div>
  )
}
