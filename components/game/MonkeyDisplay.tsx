'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import {
  buildPingPongCols,
  drawSpriteFrame,
  getMomentumTierFrames,
  getSpeakMonFrameAt,
  loadSprite,
  type SpeakRow,
  type WpmTier,
} from '@/lib/spriteUtils'

interface MonkeyDisplayProps {
  momentum: number
  isActive?: boolean
}

const DISPLAY_W = 380
const DISPLAY_H = 532
const CYCLE_SEC = 1.9
const TIER_HOLD_MS = 700
const HIGH_TIER_HOLD_MS = 950

function resolveTier(
  momentum: number,
  isActive: boolean,
  current: WpmTier
): WpmTier {
  if (!isActive || momentum < 10) return 'sleeping'

  if (current === 'mic') {
    return momentum >= 65 ? 'mic' : 'beatboxing'
  }

  if (momentum >= 82) return 'mic'

  if (current === 'beatboxing') {
    return momentum >= 12 ? 'beatboxing' : 'sleeping'
  }

  return momentum >= 18 ? 'beatboxing' : 'sleeping'
}

export default function MonkeyDisplay({ momentum, isActive = true }: MonkeyDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const lastTierRef = useRef<WpmTier>('sleeping')
  const lastTierChangeAtRef = useRef(0)
  const animCtxRef = useRef<gsap.Context | null>(null)
  const reducedMotionRef = useRef(false)

  const paintCol = (row: SpeakRow, col: number) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const img = imgRef.current
    if (!canvas || !ctx || !img) return
    const frame = getSpeakMonFrameAt(img, row, col)
    drawSpriteFrame(ctx, img, frame, DISPLAY_W, DISPLAY_H)
  }

  const startTierAnimation = (tier: WpmTier) => {
    animCtxRef.current?.revert()
    animCtxRef.current = null

    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return

    const { row, cols } = getMomentumTierFrames(tier)
    const reduced = reducedMotionRef.current

    if (reduced || cols.length <= 1) {
      const col = cols[Math.floor(cols.length / 2)] ?? cols[0]!
      paintCol(row, col)
      return
    }

    const sequence = buildPingPongCols(cols)
    const stepDuration = CYCLE_SEC / Math.max(1, 2 * (cols.length - 1))

    animCtxRef.current = gsap.context(() => {
      const tl = gsap.timeline({ repeat: -1 })
      for (const col of sequence) {
        tl.call(() => paintCol(row, col))
        tl.to({}, { duration: stepDuration })
      }
    }, canvasRef)
  }

  const applyTier = (value: number) => {
    const currentTier = lastTierRef.current
    const desiredTier = resolveTier(value, isActive, currentTier)
    const now = performance.now()
    const holdMs = desiredTier === 'mic' ? HIGH_TIER_HOLD_MS : TIER_HOLD_MS

    if (desiredTier !== currentTier && now - lastTierChangeAtRef.current < holdMs) {
      if (animCtxRef.current) return
    }

    const tier = desiredTier !== currentTier && now - lastTierChangeAtRef.current >= holdMs
      ? desiredTier
      : currentTier

    if (tier === currentTier && animCtxRef.current) return

    lastTierRef.current = tier
    lastTierChangeAtRef.current = now

    startTierAnimation(tier)
  }

  useEffect(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: reduce)', () => {
      reducedMotionRef.current = true
      if (imgRef.current) applyTier(momentum)
    })
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      reducedMotionRef.current = false
      if (imgRef.current) {
        lastTierRef.current = 'sleeping'
        lastTierChangeAtRef.current = performance.now()
        applyTier(momentum)
      }
    })
    return () => mm.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [momentum])

  useEffect(() => {
    let cancelled = false

    loadSprite('/speak_mon.png').then((img) => {
      if (cancelled) return
      imgRef.current = img
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = DISPLAY_W
        canvas.height = DISPLAY_H
        lastTierRef.current = 'sleeping'
        lastTierChangeAtRef.current = performance.now()
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
    if (!imgRef.current) return
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
