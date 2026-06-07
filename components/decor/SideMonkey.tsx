'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import {
  drawSpriteFrame,
  getSideMonFrameRect,
  loadSprite,
  SIDE_MON_FRAMES,
} from '@/lib/spriteUtils'

const DISPLAY_W = 200
const DISPLAY_H = 240
const LOOP_FPS = 8

interface SideMonkeyProps {
  micHovered?: boolean
}

export default function SideMonkey({ micHovered = false }: SideMonkeyProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const loopRef = useRef<gsap.core.Timeline | null>(null)

  const paintFrame = (index: number) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const img = imgRef.current
    if (!canvas || !ctx || !img) return
    drawSpriteFrame(ctx, img, getSideMonFrameRect(img, index), DISPLAY_W, DISPLAY_H, 'bottom-left')
  }

  useEffect(() => {
    let cancelled = false
    const container = containerRef.current
    if (!container) return

    const ctx = gsap.context(() => {
      gsap.from(container, {
        x: -24,
        opacity: 0,
        duration: 0.6,
        ease: 'power2.out',
        delay: 0.3,
      })
    }, containerRef)

    loadSprite('/side_mon.png').then((img) => {
      if (cancelled) return
      imgRef.current = img
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = DISPLAY_W
        canvas.height = DISPLAY_H
        paintFrame(0)
        loopRef.current?.kill()
        const tl = gsap.timeline({ repeat: -1 })
        for (let i = 0; i < SIDE_MON_FRAMES; i++) {
          tl.call(() => paintFrame(i), undefined, i / LOOP_FPS)
          tl.to({}, { duration: 1 / LOOP_FPS })
        }
        loopRef.current = tl
      }
    })

    return () => {
      cancelled = true
      loopRef.current?.kill()
      ctx.revert()
    }
  }, [])

  useEffect(() => {
    if (!imgRef.current) return

    if (micHovered) {
      loopRef.current?.pause()
      paintFrame(1)
      return
    }

    loopRef.current?.resume()
  }, [micHovered])

  return (
    <div ref={containerRef} className="side-monkey" aria-hidden>
      <canvas ref={canvasRef} className="side-monkey-canvas" />
    </div>
  )
}
