'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import type { CompanionState } from '@/hooks/useVoiceActivity'
import {
  drawSpriteFrame,
  getMainMonFrameIndex,
  getMainMonFrameRect,
  getSpeakMonFrameRect,
  getSpeakRow,
  getSpeakRowFrameCount,
  loadSprite,
  shouldUseSpeakMon,
} from '@/lib/spriteUtils'

interface MonkeyDisplayProps {
  liveWpm: number
  momentum: number
  companionState: CompanionState
  isActive?: boolean
}

const DISPLAY_W = 200
const DISPLAY_H = 280
const SPEAK_FRAME_MS = 120

export default function MonkeyDisplay({
  liveWpm,
  momentum,
  companionState,
  isActive = true,
}: MonkeyDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mainImgRef = useRef<HTMLImageElement | null>(null)
  const speakImgRef = useRef<HTMLImageElement | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const speakFrameRef = useRef(0)
  const lastSpeakTickRef = useRef(0)
  const lastSpeakRowRef = useRef('')
  const currentMainFrameRef = useRef(0)

  const paint = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const mainImg = mainImgRef.current
    const speakImg = speakImgRef.current
    if (!canvas || !ctx || !mainImg || !speakImg) return

    const useSpeak = shouldUseSpeakMon(liveWpm, momentum, companionState)

    if (useSpeak) {
      const row = getSpeakRow(momentum)
      if (row !== lastSpeakRowRef.current) {
        lastSpeakRowRef.current = row
        speakFrameRef.current = 0
      }
      const frameRect = getSpeakMonFrameRect(speakImg, row, speakFrameRef.current)
      drawSpriteFrame(ctx, speakImg, frameRect, DISPLAY_W, DISPLAY_H)
    } else {
      const frameIndex = getMainMonFrameIndex(liveWpm, momentum, companionState)
      currentMainFrameRef.current = frameIndex
      drawSpriteFrame(ctx, mainImg, getMainMonFrameRect(mainImg, frameIndex), DISPLAY_W, DISPLAY_H)
    }
  }

  useEffect(() => {
    let cancelled = false

    Promise.all([loadSprite('/main_mon.png'), loadSprite('/speak_mon.png')]).then(
      ([mainImg, speakImg]) => {
        if (cancelled) return
        mainImgRef.current = mainImg
        speakImgRef.current = speakImg
        const canvas = canvasRef.current
        if (canvas) {
          canvas.width = DISPLAY_W
          canvas.height = DISPLAY_H
          paint()
        }
      }
    )

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isActive) return

    const tick = (now: number) => {
      const useSpeak = shouldUseSpeakMon(liveWpm, momentum, companionState)

      if (useSpeak) {
        const row = getSpeakRow(momentum)
        const frameCount = getSpeakRowFrameCount(row)
        if (now - lastSpeakTickRef.current >= SPEAK_FRAME_MS) {
          speakFrameRef.current = (speakFrameRef.current + 1) % frameCount
          lastSpeakTickRef.current = now
        }
      }

      paint()
      animFrameRef.current = requestAnimationFrame(tick)
    }

    animFrameRef.current = requestAnimationFrame(tick)

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, liveWpm, momentum, companionState])

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
