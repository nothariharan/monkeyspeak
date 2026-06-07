'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import {
  drawSpriteFrame,
  getMomentumTier,
  getSpeakMonFrameForTier,
  loadSprite,
} from '@/lib/spriteUtils'

interface MonkeyDisplayProps {
  momentum: number
  isActive?: boolean
}

const DISPLAY_W = 300
const DISPLAY_H = 420

export default function MonkeyDisplay({ momentum, isActive = true }: MonkeyDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const lastTierRef = useRef<string>('')

  const paintTier = (value: number) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const img = imgRef.current
    if (!canvas || !ctx || !img) return

    const tier = getMomentumTier(value)
    if (tier === lastTierRef.current) return

    const prevTier = lastTierRef.current
    lastTierRef.current = tier

    const frame = getSpeakMonFrameForTier(img, tier)
    drawSpriteFrame(ctx, img, frame, DISPLAY_W, DISPLAY_H)

    if (prevTier && containerRef.current) {
      gsap.fromTo(
        containerRef.current,
        { scale: 0.96 },
        { scale: 1, duration: 0.25, ease: 'back.out(2)' }
      )
    }
  }

  useEffect(() => {
    let cancelled = false

    loadSprite('/speak_mon.png').then((img) => {
      if (cancelled) return
      imgRef.current = img
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = DISPLAY_W
        canvas.height = DISPLAY_H
        lastTierRef.current = ''
        paintTier(momentum)
      }
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isActive || !imgRef.current) return
    paintTier(momentum)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [momentum, isActive])

  useEffect(() => {
    if (!containerRef.current) return
    const ctx = gsap.context(() => {
      gsap.from(containerRef.current, {
        y: 12,
        opacity: 0,
        duration: 0.45,
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
