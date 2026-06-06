'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

export interface WaveformVisualiserProps {
  stream: MediaStream | null
  isActive: boolean
  hasError: boolean
  barCount?: number
  embedded?: boolean
}

const BAR_WIDTH = 4
const BAR_GAP = 4
const MAX_BAR_HEIGHT = 48
const DEFAULT_BAR_COUNT = 32

type Rgb = [number, number, number]
type AudioContextWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
  }

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

function parseAccentRgb(): Rgb {
  if (typeof document === 'undefined') return [59, 130, 246]
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
  if (accent.startsWith('#')) {
    const hex = accent.slice(1)
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return [r, g, b]
  }
  return [59, 130, 246]
}

export default function WaveformVisualiser({
  stream,
  isActive,
  hasError,
  barCount = DEFAULT_BAR_COUNT,
  embedded = true,
}: WaveformVisualiserProps) {
  const containerRef = useRef<HTMLDivElement>(null)
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
  const accentRef = useRef<Rgb>([59, 130, 246])

  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  useEffect(() => {
    accentRef.current = parseAccentRgb()
  }, [isActive])

  useEffect(() => {
    heightsRef.current = Array.from({ length: barCount }, (_, i) => heightsRef.current[i] ?? 8)
    colorsRef.current = Array.from({ length: barCount }, (_, i) => colorsRef.current[i] ?? [200, 200, 200])
  }, [barCount])

  useEffect(() => {
    if (!hasError) return
    const now = performance.now()
    errorUntilRef.current = now + 600
    spikeUntilRef.current = now + 150

    const container = containerRef.current
    if (!container) return
    container.classList.remove('wave-shake')
    void container.offsetWidth
    container.classList.add('wave-shake')
    const timeout = window.setTimeout(() => container.classList.remove('wave-shake'), 520)
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
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.75
    source.connect(analyser)

    audioCtxRef.current = audioCtx
    sourceRef.current = source
    analyserRef.current = analyser
    dataArrayRef.current = new Uint8Array(analyser.fftSize)

    if (audioCtx.state === 'suspended') void audioCtx.resume()

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

    const IDLE_COLOR: Rgb = [200, 200, 200]
    const BASE_COLOR: Rgb = [180, 180, 180]

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

      analyser.getByteTimeDomainData(dataArray)
      let sumSq = 0
      for (let i = 0; i < dataArray.length; i += 1) {
        const x = (dataArray[i] - 128) / 128
        sumSq += x * x
      }
      const rms = Math.sqrt(sumSq / Math.max(1, dataArray.length))
      const envelope = Math.min(1, rms * 5.2)
      const t = performance.now() / 1000

      return Array.from({ length: barCount }, (_, index) => {
        const wobble = 0.72 + 0.28 * Math.sin(t * 7 + index * 0.38)
        return envelope * wobble * MAX_BAR_HEIGHT
      })
    }

    const getTargetColor = (height: number): Rgb => {
      const accent = accentRef.current
      const ratio = height / MAX_BAR_HEIGHT
      const bright: Rgb = [
        Math.min(255, accent[0] + 60),
        Math.min(255, accent[1] + 60),
        Math.min(255, accent[2] + 60),
      ]
      if (ratio > 0.5) return lerpColor(accent, bright, Math.min(1, (ratio - 0.5) / 0.5))
      return lerpColor(BASE_COLOR, accent, Math.min(1, ratio / 0.5))
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
      const ERROR_COLOR: Rgb = [239, 68, 68]

      ctx.clearRect(0, 0, width, height)

      for (let i = 0; i < barCount; i += 1) {
        const idleHeight = Math.sin(Date.now() / 700 + i * 0.45) * 6 + 10
        const audioHeight = audioTargets?.[i] ?? idleHeight
        const targetHeight = isActiveRef.current && audioTargets ? audioHeight : idleHeight
        const smoothHeight = lerp(heightsRef.current[i] ?? 8, targetHeight, 0.18)
        const renderedHeight = Math.max(4, Math.min(MAX_BAR_HEIGHT, isSpiking ? smoothHeight * 1.4 : smoothHeight))
        const targetColor = isError ? ERROR_COLOR : isActiveRef.current ? getTargetColor(renderedHeight) : IDLE_COLOR

        heightsRef.current[i] = smoothHeight
        colorsRef.current[i] = lerpColor(colorsRef.current[i] ?? targetColor, targetColor, isError ? 0.65 : 0.18)

        const x = startX + i * (BAR_WIDTH + BAR_GAP)
        const y = centerY - renderedHeight / 2

        ctx.fillStyle = rgbToCss(colorsRef.current[i])
        ctx.fillRect(x, y, BAR_WIDTH, renderedHeight)
      }

      animationRef.current = window.requestAnimationFrame(render)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    animationRef.current = window.requestAnimationFrame(render)

    return () => {
      if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [barCount])

  useEffect(() => {
    if (!containerRef.current || !isActive) return
    const ctx = gsap.context(() => {
      gsap.from(containerRef.current, { opacity: 0, y: 8, duration: 0.35, ease: 'power2.out' })
    }, containerRef)
    return () => ctx.revert()
  }, [isActive])

  const wrapperStyle: React.CSSProperties = embedded
    ? {
        width: '100%',
        height: 64,
        borderTop: '3px solid var(--border)',
        background: 'var(--surface)',
      }
    : {
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100vw',
        height: 88,
        zIndex: 50,
        background: 'var(--surface)',
        borderTop: '3px solid var(--border)',
        pointerEvents: 'none',
      }

  return (
    <div ref={containerRef} aria-hidden="true" style={wrapperStyle}>
      <style>{`
        @keyframes waveShake {
          0%   { transform: translateX(0) }
          20%  { transform: translateX(-5px) }
          40%  { transform: translateX(5px) }
          60%  { transform: translateX(-3px) }
          80%  { transform: translateX(3px) }
          100% { transform: translateX(0) }
        }
        .wave-shake { animation: waveShake 0.5s ease-out forwards; }
      `}</style>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  )
}
