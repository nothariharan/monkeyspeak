'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { buildPingPongCols } from '@/lib/spriteUtils'
import {
  drawFrameImage,
  getMomentumSpriteTier,
  loadAllMomentumSprites,
  type MomentumSpriteTier,
} from '@/lib/momentumSprites'

interface MonkeyDisplayProps {
  momentum: number
  isActive?: boolean
}

const DISPLAY_W = 380
const DISPLAY_H = 532
const CROSSFADE_SEC = 0.25

const TIER_CYCLE_SEC: Record<MomentumSpriteTier, number> = {
  sleep:  3.2,
  '10+':  1.8,
  '70+':  1.35,
  '90+':  1.0,
  '120+': 0.75,
}

// Pendulum easing: turning-point frames linger, fast middle frames rush.
// Returns durations in milliseconds for use with rAF timestamp accumulation.
function buildEasedDurationsMs(sequenceLength: number, totalSec: number): number[] {
  const m = sequenceLength
  if (m <= 1) return [totalSec * 1000]
  const n = (m + 1) / 2
  const weights = Array.from({ length: m }, (_, i) => {
    const angle = Math.PI * Math.min(i, m - 1 - i) / (n - 1)
    let w = 0.3 + 0.7 * Math.abs(Math.cos(angle))
    if (i === 0 || i === m - 1) w *= 0.5
    return w
  })
  const sum = weights.reduce((a, b) => a + b, 0)
  return weights.map(w => (w / sum) * totalSec * 1000)
}

// Hysteresis band: momentum must move this far past a threshold before the tier
// changes, preventing rapid oscillation when momentum sits near a boundary.
const HYST = 6

function resolveNextTier(
  momentum: number,
  isActive: boolean,
  current: MomentumSpriteTier | null
): MomentumSpriteTier {
  if (!isActive || momentum <= 0) return 'sleep'
  if (current === null) return getMomentumSpriteTier(momentum, isActive)
  switch (current) {
    case 'sleep':  return momentum >= 8             ? '10+'  : 'sleep'
    case '10+':    return momentum <= 0             ? 'sleep'
                        : momentum >= 70 + HYST     ? '70+'  : '10+'
    case '70+':    return momentum <  70 - HYST     ? '10+'
                        : momentum >= 90 + HYST     ? '90+'  : '70+'
    case '90+':    return momentum <  90 - HYST     ? '70+'
                        : momentum >= 120 + HYST    ? '120+' : '90+'
    case '120+':   return momentum < 120 - HYST     ? '90+'  : '120+'
  }
}

type Slot = 'a' | 'b'

export default function MonkeyDisplay({ momentum, isActive = true }: MonkeyDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<Record<Slot, HTMLCanvasElement | null>>({ a: null, b: null })
  const activeSlotRef = useRef<Slot>('a')
  const framesRef = useRef<Partial<Record<MomentumSpriteTier, HTMLImageElement[]>>>({})
  const lastTierRef = useRef<MomentumSpriteTier | null>(null)
  const rafRefs = useRef<Record<Slot, number>>({ a: 0, b: 0 })
  const crossfadeTweensRef = useRef<gsap.core.Tween[]>([])
  const reducedMotionRef = useRef(false)
  // Kept as refs so applyTier/matchMedia callbacks always see current values
  const momentumRef = useRef(momentum)
  const isActiveRef = useRef(isActive)

  useEffect(() => { momentumRef.current = momentum }, [momentum])
  useEffect(() => { isActiveRef.current = isActive }, [isActive])

  const paintFrame = (slot: Slot, tier: MomentumSpriteTier, frameIndex: number) => {
    const canvas = canvasRefs.current[slot]
    const ctx = canvas?.getContext('2d')
    const frames = framesRef.current[tier]
    if (!canvas || !ctx || !frames?.length) return
    const img = frames[frameIndex % frames.length]
    if (!img) return
    drawFrameImage(ctx, img, DISPLAY_W, DISPLAY_H)
  }

  const stopSlotAnimation = (slot: Slot) => {
    if (rafRefs.current[slot]) {
      cancelAnimationFrame(rafRefs.current[slot])
      rafRefs.current[slot] = 0
    }
  }

  // rAF-driven frame stepper — more accurate than GSAP timeline dummy tweens.
  const startAnimation = (slot: Slot, tier: MomentumSpriteTier) => {
    stopSlotAnimation(slot)

    const frames = framesRef.current[tier]
    if (!frames?.length) return

    paintFrame(slot, tier, 0)
    if (reducedMotionRef.current || frames.length <= 1) return

    const sequence = buildPingPongCols(frames.map((_, i) => i))
    const durationsMs = buildEasedDurationsMs(sequence.length, TIER_CYCLE_SEC[tier])

    let frameIdx = 0
    let elapsed = 0
    let lastTime = performance.now()

    const tick = (now: number) => {
      const dt = now - lastTime
      lastTime = now
      elapsed += dt
      while (elapsed >= durationsMs[frameIdx]!) {
        elapsed -= durationsMs[frameIdx]!
        frameIdx = (frameIdx + 1) % sequence.length
        paintFrame(slot, tier, sequence[frameIdx]!)
      }
      rafRefs.current[slot] = requestAnimationFrame(tick)
    }
    rafRefs.current[slot] = requestAnimationFrame(tick)
  }

  const applyTier = (tier: MomentumSpriteTier) => {
    if (tier === lastTierRef.current) return
    const isFirst = lastTierRef.current === null
    lastTierRef.current = tier

    const outgoing = activeSlotRef.current
    const incoming: Slot = outgoing === 'a' ? 'b' : 'a'
    activeSlotRef.current = incoming

    const inCanvas = canvasRefs.current[incoming]
    const outCanvas = canvasRefs.current[outgoing]

    startAnimation(incoming, tier)

    // Kill any in-flight crossfade before starting a new one so tweens don't stack.
    for (const t of crossfadeTweensRef.current) t.kill()
    crossfadeTweensRef.current = []

    if (isFirst || reducedMotionRef.current) {
      gsap.set(inCanvas, { opacity: 1 })
      gsap.set(outCanvas, { opacity: 0 })
      stopSlotAnimation(outgoing)
      return
    }

    gsap.set(inCanvas, { opacity: 0 })
    const t1 = gsap.to(inCanvas, { opacity: 1, duration: CROSSFADE_SEC, ease: 'power1.inOut' })
    const t2 = gsap.to(outCanvas, {
      opacity: 0,
      duration: CROSSFADE_SEC,
      ease: 'power1.inOut',
      onComplete: () => {
        stopSlotAnimation(outgoing)
        crossfadeTweensRef.current = crossfadeTweensRef.current.filter(t => t !== t1 && t !== t2)
      },
    })
    crossfadeTweensRef.current = [t1, t2]
  }

  useEffect(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: reduce)', () => {
      reducedMotionRef.current = true
      if (lastTierRef.current !== null) {
        lastTierRef.current = null
        applyTier(resolveNextTier(momentumRef.current, isActiveRef.current, null))
      }
    })
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      reducedMotionRef.current = false
      if (lastTierRef.current !== null) {
        lastTierRef.current = null
        applyTier(resolveNextTier(momentumRef.current, isActiveRef.current, null))
      }
    })
    return () => mm.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Set canvas dimensions once on mount — resetting them on every tier switch
    // clears the canvas and causes a one-frame blank flash.
    const ca = canvasRefs.current.a
    const cb = canvasRefs.current.b
    if (ca) { ca.width = DISPLAY_W; ca.height = DISPLAY_H }
    if (cb) { cb.width = DISPLAY_W; cb.height = DISPLAY_H }
    gsap.set(ca, { opacity: 1 })
    gsap.set(cb, { opacity: 0 })
    activeSlotRef.current = 'a'
    lastTierRef.current = null

    let cancelled = false
    loadAllMomentumSprites().then((sprites) => {
      if (cancelled) return
      framesRef.current = sprites
      applyTier(resolveNextTier(momentumRef.current, isActiveRef.current, null))
    })

    return () => {
      cancelled = true
      stopSlotAnimation('a')
      stopSlotAnimation('b')
      for (const t of crossfadeTweensRef.current) t.kill()
      crossfadeTweensRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!framesRef.current.sleep?.length) return
    const targetTier = resolveNextTier(momentum, isActive, lastTierRef.current)
    if (targetTier === lastTierRef.current) return
    applyTier(targetTier)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [momentum, isActive])

  // Entry slide-in, then continuous float — all GSAP so they don't fight
  useEffect(() => {
    if (!containerRef.current) return
    const reduced = typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

    const ctx = gsap.context(() => {
      gsap.from(containerRef.current, {
        y: 8,
        opacity: 0,
        duration: 0.3,
        ease: 'power2.out',
        clearProps: 'y,opacity',
      })

      if (!reduced) {
        gsap.to(containerRef.current, {
          y: -7,
          delay: 0.32,
          duration: 2.8,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        })
      }
    }, containerRef)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={containerRef} className="monkey-display" aria-hidden>
      <canvas
        ref={el => { canvasRefs.current.a = el }}
        className="monkey-display-canvas"
      />
      <canvas
        ref={el => { canvasRefs.current.b = el }}
        className="monkey-display-canvas"
      />
    </div>
  )
}
