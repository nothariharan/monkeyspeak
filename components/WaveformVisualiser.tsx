'use client'

import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'

export interface WaveformVisualiserProps {
  stream: MediaStream | null
  isActive: boolean
  hasError: boolean
  barCount?: number
}

const BAR_WIDTH = 3
const BAR_GAP = 5
const BAR_RADIUS = 2
const MAX_BAR_HEIGHT = 36
const DEFAULT_BAR_COUNT = 28

type Rgb = [number, number, number]
type AudioContextWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
  }

const IDLE_COLOR: Rgb = [42, 42, 53]
const BASE_COLOR: Rgb = [58, 58, 80]
const ACCENT_COLOR: Rgb = [126, 184, 247]
const BRIGHT_COLOR: Rgb = [200, 216, 240]
const ERROR_COLOR: Rgb = [202, 71, 84]

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount
}

function lerpColor(from: Rgb, to: Rgb, amount: number): Rgb {
  return [
    lerp(from[0], to[0], amount),
    lerp(from[1], to[1], amount),
    lerp(from[2], to[2], amount),
  ]
}

function rgbToCss(color: Rgb) {
  return `rgb(${Math.round(color[0])}, ${Math.round(color[1])}, ${Math.round(color[2])})`
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const safeRadius = Math.min(radius, width / 2, height / 2)
  const maybeRoundRect = (ctx as CanvasRenderingContext2D & {
    roundRect?: (
      x: number,
      y: number,
      w: number,
      h: number,
      radii?: number | DOMPointInit | Iterable<number | DOMPointInit>
    ) => void
  }).roundRect

  if (maybeRoundRect) {
    ctx.beginPath()
    maybeRoundRect.call(ctx, x, y, width, height, safeRadius)
    ctx.fill()
    return
  }

  ctx.beginPath()
  ctx.moveTo(x + safeRadius, y)
  ctx.lineTo(x + width - safeRadius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
  ctx.lineTo(x + width, y + height - safeRadius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
  ctx.lineTo(x + safeRadius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
  ctx.lineTo(x, y + safeRadius)
  ctx.quadraticCurveTo(x, y, x + safeRadius, y)
  ctx.closePath()
  ctx.fill()
}

export default function WaveformVisualiser({
  stream,
  isActive,
  hasError,
  barCount = DEFAULT_BAR_COUNT,
}: WaveformVisualiserProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const heightsRef = useRef<number[]>([])
  const colorsRef = useRef<Rgb[]>([])
  const isActiveRef = useRef(isActive)
  const errorUntilRef = useRef(0)
  const spikeUntilRef = useRef(0)

  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  useEffect(() => {
    heightsRef.current = Array.from({ length: barCount }, (_, i) => heightsRef.current[i] ?? 8)
    colorsRef.current = Array.from({ length: barCount }, (_, i) => colorsRef.current[i] ?? IDLE_COLOR)
  }, [barCount])

  useEffect(() => {
    if (!hasError) return

    const now = performance.now()
    errorUntilRef.current = now + 600
    spikeUntilRef.current = now + 150

    const canvas = canvasRef.current
    if (!canvas) return

    canvas.classList.remove('wave-shake')
    void canvas.offsetWidth
    canvas.classList.add('wave-shake')

    const timeout = window.setTimeout(() => {
      canvas.classList.remove('wave-shake')
    }, 520)

    return () => window.clearTimeout(timeout)
  }, [hasError])

  useEffect(() => {
    if (!stream) {
      analyserRef.current = null
      dataArrayRef.current = null
      return
    }

    const AudioContextCtor = window.AudioContext || (window as AudioContextWindow).webkitAudioContext
    if (!AudioContextCtor) return

    const audioCtx = new AudioContextCtor()
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()

    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8
    source.connect(analyser)

    audioCtxRef.current = audioCtx
    sourceRef.current = source
    analyserRef.current = analyser
    dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount)

    if (audioCtx.state === 'suspended') {
      void audioCtx.resume()
    }

    return () => {
      source.disconnect()
      analyser.disconnect()
      analyserRef.current = null
      sourceRef.current = null
      dataArrayRef.current = null
      audioCtxRef.current = null
      void audioCtx.close()
    }
  }, [stream])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1
      const width = canvas.clientWidth
      const height = canvas.clientHeight

      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const getTargetsFromAudio = () => {
      const analyser = analyserRef.current
      const dataArray = dataArrayRef.current

      if (!analyser || !dataArray) return null

      analyser.getByteFrequencyData(dataArray)

      const bucketSize = Math.max(1, Math.floor(dataArray.length / barCount))
      return Array.from({ length: barCount }, (_, index) => {
        const start = index * bucketSize
        const end = index === barCount - 1 ? dataArray.length : Math.min(dataArray.length, start + bucketSize)
        let total = 0

        for (let i = start; i < end; i += 1) {
          total += dataArray[i]
        }

        const average = total / Math.max(1, end - start)
        return (average / 255) * MAX_BAR_HEIGHT
      })
    }

    const getTargetColor = (height: number): Rgb => {
      const ratio = height / MAX_BAR_HEIGHT

      if (ratio > 0.75) {
        return lerpColor(ACCENT_COLOR, BRIGHT_COLOR, Math.min(1, (ratio - 0.75) / 0.25))
      }

      if (ratio > 0.4) {
        return lerpColor(BASE_COLOR, ACCENT_COLOR, Math.min(1, (ratio - 0.4) / 0.35))
      }

      return BASE_COLOR
    }

    const render = () => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      const centerY = height / 2
      const now = performance.now()
      const isError = now < errorUntilRef.current
      const isSpiking = now < spikeUntilRef.current
      const audioTargets = isActiveRef.current ? getTargetsFromAudio() : null
      const totalBarsWidth = barCount * BAR_WIDTH + (barCount - 1) * BAR_GAP
      const startX = (width - totalBarsWidth) / 2

      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#0e0e10'
      ctx.fillRect(0, 0, width, height)

      for (let i = 0; i < barCount; i += 1) {
        const idleHeight = Math.sin(Date.now() / 700 + i * 0.45) * 6 + 8
        const audioHeight = audioTargets?.[i] ?? idleHeight
        const targetHeight = isActiveRef.current && audioTargets ? audioHeight : idleHeight
        const smoothHeight = lerp(heightsRef.current[i] ?? 8, targetHeight, 0.18)
        const renderedHeight = Math.max(2, Math.min(MAX_BAR_HEIGHT, isSpiking ? smoothHeight * 1.4 : smoothHeight))
        const targetColor = isError ? ERROR_COLOR : isActiveRef.current ? getTargetColor(renderedHeight) : IDLE_COLOR

        heightsRef.current[i] = smoothHeight
        colorsRef.current[i] = lerpColor(colorsRef.current[i] ?? targetColor, targetColor, isError ? 0.65 : 0.18)

        const x = startX + i * (BAR_WIDTH + BAR_GAP)
        const y = centerY - renderedHeight

        ctx.fillStyle = rgbToCss(colorsRef.current[i])
        drawRoundedRect(ctx, x, y, BAR_WIDTH, renderedHeight * 2, BAR_RADIUS)
      }

      animationRef.current = window.requestAnimationFrame(render)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    animationRef.current = window.requestAnimationFrame(render)

    return () => {
      if (animationRef.current !== null) {
        window.cancelAnimationFrame(animationRef.current)
      }
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [barCount])

  return (
    <motion.div
      aria-hidden="true"
      initial={{ opacity: 0.5, y: 10 }}
      animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0.5, y: 10 }}
      transition={isActive ? { duration: 0.4, ease: 'easeOut' } : { duration: 0.3, ease: 'easeIn' }}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100vw',
        height: 88,
        zIndex: 50,
        background: '#0e0e10',
        pointerEvents: 'none',
      }}
    >
      <style>{`
        @keyframes waveShake {
          0%   { transform: translateX(0) }
          20%  { transform: translateX(-5px) }
          40%  { transform: translateX(5px) }
          60%  { transform: translateX(-3px) }
          80%  { transform: translateX(3px) }
          100% { transform: translateX(0) }
        }

        .wave-shake {
          animation: waveShake 0.5s ease-out forwards;
        }
      `}</style>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </motion.div>
  )
}
