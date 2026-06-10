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
const CYCLE_SEC = 1.65

function tierForMomentum(momentum: number, isActive: boolean): MomentumSpriteTier {
  return getMomentumSpriteTier(momentum, isActive)
}

export default function MonkeyDisplay({ momentum, isActive = true }: MonkeyDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const framesRef = useRef<Partial<Record<MomentumSpriteTier, HTMLImageElement[]>>>({})
  const lastTierRef = useRef<MomentumSpriteTier>('sleep')
  const animCtxRef = useRef<gsap.Context | null>(null)
  const reducedMotionRef = useRef(false)

  const paintFrame = (tier: MomentumSpriteTier, frameIndex: number) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const frames = framesRef.current[tier]
    if (!canvas || !ctx || !frames?.length) return
    const img = frames[frameIndex % frames.length]
    if (!img) return
    drawFrameImage(ctx, img, DISPLAY_W, DISPLAY_H)
  }

  const startTierAnimation = (tier: MomentumSpriteTier) => {
    animCtxRef.current?.revert()
    animCtxRef.current = null

    const canvas = canvasRef.current
    const frames = framesRef.current[tier]
    if (!canvas || !frames?.length) return

    const reduced = reducedMotionRef.current
    const indices = frames.map((_, i) => i)

    if (reduced || indices.length <= 1) {
      paintFrame(tier, Math.floor(indices.length / 2))
      return
    }

    const sequence = buildPingPongCols(indices)
    const stepDuration = CYCLE_SEC / Math.max(1, sequence.length)

    animCtxRef.current = gsap.context(() => {
      const tl = gsap.timeline({ repeat: -1 })
      for (const frameIndex of sequence) {
        tl.call(() => paintFrame(tier, frameIndex))
        tl.to({}, { duration: stepDuration })
      }
    }, canvasRef)
  }

  const applyTier = (value: number) => {
    const tier = tierForMomentum(value, isActive)
    if (tier === lastTierRef.current && animCtxRef.current) return

    lastTierRef.current = tier
    startTierAnimation(tier)
  }

  useEffect(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: reduce)', () => {
      reducedMotionRef.current = true
      if (Object.keys(framesRef.current).length > 0) applyTier(momentum)
    })
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      reducedMotionRef.current = false
      if (Object.keys(framesRef.current).length > 0) applyTier(momentum)
    })
    return () => mm.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false

    loadAllMomentumSprites().then((sprites) => {
      if (cancelled) return
      framesRef.current = sprites
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = DISPLAY_W
        canvas.height = DISPLAY_H
        lastTierRef.current = 'sleep'
        applyTier(momentum)
      }
    })

    return () => {
      cancelled = true
      animCtxRef.current?.revert()
      animCtxRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!framesRef.current.sleep?.length) return
    applyTier(momentum)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [momentum, isActive])

  useEffect(() => {
    if (!containerRef.current) return
    const ctx = gsap.context(() => {
      gsap.from(containerRef.current, {
        y: 6,
        opacity: 0,
        duration: 0.28,
        ease: 'power2.out',
      })
    }, containerRef)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={containerRef} className="monkey-display" aria-hidden>
      <canvas ref={canvasRef} className="monkey-display-canvas" />
    </div>
  )
}
