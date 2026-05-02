'use client'

import { useEffect, useRef, useState } from 'react'
import type { WpmSnapshot } from '@/store/testStore'

const LINE = '#7eb8f7'
const FILL = 'rgba(126, 184, 247, 0.07)'
const AXIS = '#2e2e38'

interface SparklineChartProps {
  wpmSnapshots: WpmSnapshot[]
  testStartedAt: number | null
  width?: string
  height?: number
}

function buildPoints(snapshots: WpmSnapshot[], testStartedAt: number | null): { t: number; wpm: number }[] {
  if (testStartedAt == null || snapshots.length === 0) return []
  return snapshots.map((s) => ({
    t: (s.timestamp - testStartedAt) / 1000,
    wpm: s.wpm,
  }))
}

export default function SparklineChart({
  wpmSnapshots,
  testStartedAt,
  width = '100%',
  height = 110,
}: SparklineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [sizeTick, setSizeTick] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSizeTick((t) => t + 1))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const points = buildPoints(wpmSnapshots, testStartedAt)
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1
    const cssW = wrap.clientWidth || 300
    const cssH = height
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssW, cssH)

    if (points.length < 2) return

    const wpms = points.map((p) => p.wpm)
    let minWpm = Math.min(...wpms)
    let maxWpm = Math.max(...wpms)
    if (maxWpm === minWpm) {
      minWpm = Math.max(0, minWpm - 10)
      maxWpm = maxWpm + 10
    }
    const padY = cssH * 0.1
    const chartH = cssH * 0.8
    const bottomY = cssH - padY

    const toX = (i: number) => (i / (points.length - 1)) * cssW
    const toY = (wpm: number) =>
      bottomY - ((wpm - minWpm) / (maxWpm - minWpm)) * chartH

    ctx.strokeStyle = AXIS
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, bottomY)
    ctx.lineTo(cssW, bottomY)
    ctx.stroke()

    const px = points.map((p, i) => ({ x: toX(i), y: toY(p.wpm) }))

    ctx.beginPath()
    ctx.moveTo(px[0]!.x, bottomY)
    for (let i = 0; i < px.length - 1; i++) {
      const p0 = px[i]!
      const p1 = px[i + 1]!
      const mx = (p0.x + p1.x) / 2
      const my = (p0.y + p1.y) / 2
      ctx.quadraticCurveTo(p0.x, p0.y, mx, my)
    }
    const lastPt = px[px.length - 1]!
    ctx.lineTo(lastPt.x, lastPt.y)
    ctx.lineTo(lastPt.x, bottomY)
    ctx.lineTo(px[0]!.x, bottomY)
    ctx.closePath()
    ctx.fillStyle = FILL
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(px[0]!.x, px[0]!.y)
    for (let i = 0; i < px.length - 1; i++) {
      const p0 = px[i]!
      const p1 = px[i + 1]!
      const mx = (p0.x + p1.x) / 2
      const my = (p0.y + p1.y) / 2
      ctx.quadraticCurveTo(p0.x, p0.y, mx, my)
    }
    ctx.lineTo(lastPt.x, lastPt.y)
    ctx.strokeStyle = LINE
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(lastPt.x, lastPt.y, 3, 0, Math.PI * 2)
    ctx.fillStyle = LINE
    ctx.fill()
  }, [wpmSnapshots, testStartedAt, height, sizeTick])

  const points = buildPoints(wpmSnapshots, testStartedAt)

  return (
    <div ref={wrapRef} style={{ width, position: 'relative' }}>
      {points.length < 2 ? (
        <div
          className="flex items-center justify-center text-xs font-mono"
          style={{ height, color: AXIS }}
        >
          not enough data
        </div>
      ) : (
        <canvas ref={canvasRef} aria-hidden />
      )}
    </div>
  )
}
