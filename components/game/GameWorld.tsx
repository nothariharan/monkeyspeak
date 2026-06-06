'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { gsap } from 'gsap'
import Bird, { type BirdState } from '@/components/game/Bird'
import type { GameEvent } from '@/lib/liveAlign'
import { wpmToScrollOffset } from '@/lib/game/worldTiers'

interface GameWorldProps {
  liveWpm: number
  height: number
  streak: number
  events: GameEvent[]
}

interface Particle {
  id: number
  x: number
  y: number
  text: string
}

let particleId = 0

export default function GameWorld({ liveWpm, height, streak, events }: GameWorldProps) {
  const worldRef = useRef<HTMLDivElement>(null)
  const layersRef = useRef<HTMLDivElement>(null)
  const birdWrapRef = useRef<HTMLDivElement>(null)
  const scrollQuickRef = useRef<gsap.QuickToFunc | null>(null)
  const heightQuickRef = useRef<gsap.QuickToFunc | null>(null)
  const [birdState, setBirdState] = useState<BirdState>('idle')
  const [particles, setParticles] = useState<Particle[]>([])
  const reducedMotionRef = useRef(false)

  // Init GSAP quickTo for smooth scroll + bird altitude
  useEffect(() => {
    const layers = layersRef.current
    const birdWrap = birdWrapRef.current
    if (!layers || !birdWrap) return

    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: reduce)', () => {
      reducedMotionRef.current = true
    })
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      reducedMotionRef.current = false
      gsap.set(birdWrap, { xPercent: -50 })
      scrollQuickRef.current = gsap.quickTo(layers, 'y', { duration: 1.2, ease: 'power2.out' })
      heightQuickRef.current = gsap.quickTo(birdWrap, 'y', { duration: 0.6, ease: 'power2.out' })
    })

    return () => {
      mm.revert()
      scrollQuickRef.current = null
      heightQuickRef.current = null
    }
  }, [])

  // Drive parallax scroll from live WPM
  useEffect(() => {
    const offset = wpmToScrollOffset(liveWpm)
    if (reducedMotionRef.current) {
      if (layersRef.current) layersRef.current.style.transform = `translateY(${-offset}px)`
    } else {
      scrollQuickRef.current?.(-offset)
    }
  }, [liveWpm])

  // Drive bird vertical position from height score (negative y = climb)
  useEffect(() => {
    const liftPx = Math.min(180, height * 3.5)
    if (reducedMotionRef.current) {
      if (birdWrapRef.current) {
        gsap.set(birdWrapRef.current, { xPercent: -50, y: -liftPx })
      }
    } else {
      heightQuickRef.current?.(-liftPx)
    }
  }, [height])

  // React to word events
  useEffect(() => {
    if (events.length === 0) return

    const last = events[events.length - 1]!
    if (last.type === 'correct') {
      setBirdState('rise')
      const p: Particle = {
        id: ++particleId,
        x: 50 + (Math.random() - 0.5) * 10,
        y: 45 + (Math.random() - 0.5) * 5,
        text: '+1',
      }
      setParticles((prev) => [...prev.slice(-8), p])
      window.setTimeout(() => setBirdState('idle'), 400)
    } else if (last.type === 'incorrect') {
      setBirdState('fall')
      if (worldRef.current && !reducedMotionRef.current) {
        gsap.to(worldRef.current, { x: '+=4', duration: 0.04, yoyo: true, repeat: 3, ease: 'power1.inOut' })
      }
      window.setTimeout(() => setBirdState('idle'), 500)
    } else if (last.type === 'missed') {
      setBirdState('fall')
      window.setTimeout(() => setBirdState('idle'), 350)
    }

    if (streak >= 50) setBirdState('boost')
    if (streak >= 100) setBirdState('celebrate')
  }, [events, streak])

  // Fade out particles
  const removeParticle = useCallback((id: number) => {
    setParticles((prev) => prev.filter((p) => p.id !== id))
  }, [])

  useEffect(() => {
    const timers = particles.map((p) =>
      window.setTimeout(() => removeParticle(p.id), 900)
    )
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [particles, removeParticle])

  return (
    <div ref={worldRef} className="game-world" aria-hidden>
      <div ref={layersRef} className="game-world-layers">
        {/* Tier 1 — Ground */}
        <div className="game-layer game-layer--ground">
          <div className="game-ground-hills" />
          <div className="game-ground-trees">
            <span className="game-tree" style={{ left: '8%' }} />
            <span className="game-tree" style={{ left: '22%' }} />
            <span className="game-tree" style={{ left: '75%' }} />
            <span className="game-tree" style={{ left: '88%' }} />
          </div>
          <div className="game-ground-platform" />
        </div>

        {/* Tier 2 — Mountains / clouds */}
        <div className="game-layer game-layer--mountains">
          <span className="game-cloud" style={{ left: '12%', top: '18%' }} />
          <span className="game-cloud game-cloud--lg" style={{ left: '55%', top: '12%' }} />
          <span className="game-mountain" style={{ left: '5%' }} />
          <span className="game-mountain game-mountain--sm" style={{ left: '35%' }} />
          <span className="game-mountain" style={{ right: '10%' }} />
        </div>

        {/* Tier 3 — Sky islands */}
        <div className="game-layer game-layer--sky">
          <span className="game-cloud" style={{ left: '30%', top: '8%' }} />
          <span className="game-island" style={{ left: '20%' }} />
          <span className="game-island game-island--sm" style={{ right: '25%' }} />
          <span className="game-sparkle" style={{ left: '60%', top: '20%' }}>+</span>
          <span className="game-sparkle" style={{ left: '80%', top: '35%' }}>+</span>
        </div>

        {/* Tier 4 — Space */}
        <div className="game-layer game-layer--space">
          <span className="game-star" style={{ left: '10%', top: '5%' }} />
          <span className="game-star" style={{ left: '40%', top: '15%' }} />
          <span className="game-star" style={{ left: '70%', top: '8%' }} />
          <span className="game-star" style={{ left: '90%', top: '22%' }} />
          <span className="game-planet" style={{ right: '15%', top: '10%' }} />
          <span className="game-comet" style={{ left: '5%', top: '25%' }} />
        </div>

        {/* Tier 5 — Mythic */}
        <div className="game-layer game-layer--mythic">
          <span className="game-monument" style={{ left: '25%' }} />
          <span className="game-golden-cloud" style={{ left: '50%', top: '5%' }} />
          <span className="game-monument game-monument--sm" style={{ right: '20%' }} />
        </div>
      </div>

      {/* Particles */}
      {particles.map((p) => (
        <span
          key={p.id}
          className="game-particle"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
        >
          {p.text}
        </span>
      ))}

      {/* Bird */}
      <div ref={birdWrapRef} className="game-bird-wrap">
        <Bird state={birdState} streak={streak} />
        {streak >= 25 && <div className="game-trail" />}
      </div>
    </div>
  )
}
