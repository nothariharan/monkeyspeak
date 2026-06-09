'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import {
  buildPingPongCols,
  drawSpriteFrame,
  getMomentumTier,
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

function tierForMomentum(momentum: number, isActive: boolean): WpmTier {
  if (!isActive || momentum <= 0) return 'sleeping'
  return getMomentumTier(momentum)
}

export default function MonkeyDisplay({ momentum, isActive = true }: MonkeyDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const lastTierRef = useRef<WpmTier>('sleeping')
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
    const tier = tierForMomentum(value, isActive)
    if (tier === lastTierRef.current && animCtxRef.current) return

    lastTierRef.current = tier
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
      if (imgRef.current) applyTier(momentum)
    })
    return () => mm.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
