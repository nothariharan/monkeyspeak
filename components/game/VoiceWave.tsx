'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

interface VoiceWaveProps {
  stream: MediaStream | null
  isActive: boolean
  /** 0–1 live activity for browser STT or fallback when mic analyser is flat. */
  activityLevel?: number
  barCount?: number
}

const BAR_WIDTH = 4
const BAR_GAP = 3
const MAX_BAR_HEIGHT = 44

type Rgb = [number, number, number]
type AudioContextWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
  }

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
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

function parseAccentRgb(): Rgb {
  if (typeof document === 'undefined') return [59, 130, 246]
  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent')
    .trim()
  if (accent.startsWith('#')) {
    const hex = accent.slice(1)
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ]
  }
  return [59, 130, 246]
}

function drawRoundedBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  const r = Math.min(w / 2, h / 2)
  ctx.fillStyle = color
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
    ctx.fill()
  } else {
    ctx.fillRect(x, y, w, h)
  }
}

export default function VoiceWave({
  stream,
  isActive,
  activityLevel = 0,
  barCount: barCountProp,
}: VoiceWaveProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const timeDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const heightsRef = useRef<number[]>([])
  const colorsRef = useRef<Rgb[]>([])
  const isActiveRef = useRef(isActive)
  const activityRef = useRef(activityLevel)
  const accentRef = useRef<Rgb>([59, 130, 246])
  const barCountRef = useRef(barCountProp ?? 40)

  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  useEffect(() => {
    activityRef.current = activityLevel
  }, [activityLevel])

  useEffect(() => {
    accentRef.current = parseAccentRgb()
  }, [isActive])

  // WebAudio — time-domain data drives the waveform
  useEffect(() => {
    if (!stream || !isActive) {
      analyserRef.current = null
      timeDataRef.current = null
      return
    }

    const AudioContextCtor =
      window.AudioContext || (window as AudioContextWindow).webkitAudioContext
    if (!AudioContextCtor) return

    const audioCtx = new AudioContextCtor()
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.72
    source.connect(analyser)

    audioCtxRef.current = audioCtx
    sourceRef.current = source
    analyserRef.current = analyser
    timeDataRef.current = new Uint8Array(analyser.fftSize)

    if (audioCtx.state === 'suspended') void audioCtx.resume()

    return () => {
      source.disconnect()
      analyser.disconnect()
      analyserRef.current = null
      sourceRef.current = null
      timeDataRef.current = null
      audioCtxRef.current = null
      void audioCtx.close()
    }
  }, [stream, isActive])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const IDLE_COLOR: Rgb = [190, 190, 190]
    const BASE_COLOR: Rgb = [175, 175, 175]

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Fit bar count to available width
      if (!barCountProp) {
        const fit = Math.floor((width + BAR_GAP) / (BAR_WIDTH + BAR_GAP))
        barCountRef.current = Math.max(24, Math.min(56, fit))
      } else {
        barCountRef.current = barCountProp
      }
      const n = barCountRef.current
      heightsRef.current = Array.from({ length: n }, (_, i) => heightsRef.current[i] ?? 8)
      colorsRef.current = Array.from({ length: n }, (_, i) => colorsRef.current[i] ?? IDLE_COLOR)
    }

    const getSyntheticTargets = (level: number) => {
      const t = performance.now() / 1000
      const n = barCountRef.current
      const envelope = Math.max(0.18, Math.min(1, level))
      return Array.from({ length: n }, (_, index) => {
        const wobble = 0.65 + 0.35 * Math.sin(t * 8 + index * 0.42)
        const ripple = 0.85 + 0.15 * Math.sin(t * 3.5 + index * 0.18)
        return envelope * wobble * ripple * MAX_BAR_HEIGHT
      })
    }

    const getTargetsFromAudio = () => {
      const analyser = analyserRef.current
      const timeData = timeDataRef.current
      if (!analyser || !timeData) return null

      analyser.getByteTimeDomainData(timeData)
      let sumSq = 0
      for (let i = 0; i < timeData.length; i++) {
        const x = (timeData[i]! - 128) / 128
        sumSq += x * x
      }
      const rms = Math.sqrt(sumSq / timeData.length)
      const envelope = Math.min(1, rms * 5.2)
      if (envelope > 0.06 && audioCtxRef.current?.state === 'suspended') {
        void audioCtxRef.current.resume()
      }
      const boosted = Math.max(envelope, activityRef.current * 0.55)
      const t = performance.now() / 1000
      const n = barCountRef.current

      return Array.from({ length: n }, (_, index) => {
        const wobble = 0.65 + 0.35 * Math.sin(t * 8 + index * 0.42)
        const ripple = 0.85 + 0.15 * Math.sin(t * 3.5 + index * 0.18)
        return boosted * wobble * ripple * MAX_BAR_HEIGHT
      })
    }

    const getColor = (height: number): Rgb => {
      const accent = accentRef.current
      const ratio = height / MAX_BAR_HEIGHT
      const bright: Rgb = [
        Math.min(255, accent[0] + 55),
        Math.min(255, accent[1] + 55),
        Math.min(255, accent[2] + 55),
      ]
      if (ratio > 0.45) return lerpColor(accent, bright, Math.min(1, (ratio - 0.45) / 0.55))
      return lerpColor(BASE_COLOR, accent, Math.min(1, ratio / 0.45))
    }

    const render = () => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      const centerY = height / 2
      const n = barCountRef.current
      const level = activityRef.current
      const audioTargets = isActiveRef.current && analyserRef.current ? getTargetsFromAudio() : null
      const syntheticTargets =
        isActiveRef.current && !audioTargets && level > 0.04
          ? getSyntheticTargets(level)
          : null
      const waveTargets = audioTargets ?? syntheticTargets
      const totalWidth = n * BAR_WIDTH + (n - 1) * BAR_GAP
      const startX = (width - totalWidth) / 2

      ctx.clearRect(0, 0, width, height)

      for (let i = 0; i < n; i++) {
        const idleHeight = Math.sin(performance.now() / 800 + i * 0.5) * 5 + 9
        const target = isActiveRef.current && waveTargets ? waveTargets[i]! : idleHeight
        const smooth = lerp(heightsRef.current[i] ?? 8, target, 0.2)
        const barH = Math.max(6, Math.min(MAX_BAR_HEIGHT, smooth))
        const targetColor =
          isActiveRef.current && waveTargets && barH > 10
            ? getColor(barH)
            : IDLE_COLOR

        heightsRef.current[i] = smooth
        colorsRef.current[i] = lerpColor(
          colorsRef.current[i] ?? targetColor,
          targetColor,
          0.2
        )

        const x = startX + i * (BAR_WIDTH + BAR_GAP)
        const y = centerY - barH / 2
        drawRoundedBar(ctx, x, y, BAR_WIDTH, barH, rgbToCss(colorsRef.current[i]!))
      }

      animationRef.current = requestAnimationFrame(render)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    animationRef.current = requestAnimationFrame(render)

    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [barCountProp])

  useEffect(() => {
    if (!containerRef.current || !isActive) return
    const ctx = gsap.context(() => {
      gsap.from(containerRef.current, {
        opacity: 0,
        y: 6,
        duration: 0.4,
        ease: 'power2.out',
      })
    }, containerRef)
    return () => ctx.revert()
  }, [isActive])

  return (
    <div ref={containerRef} className="voice-wave" aria-hidden>
      <canvas ref={canvasRef} className="voice-wave-canvas" />
    </div>
  )
}
