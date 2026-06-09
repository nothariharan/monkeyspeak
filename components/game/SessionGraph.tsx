'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import type { SessionTimeline } from '@/store/testStore'

interface SessionGraphProps {
  timeline: SessionTimeline
  durationSec: number
}

const W = 640
const H = 200
const PAD = { top: 16, right: 48, bottom: 28, left: 44 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

function buildPoints(
  data: { second: number; wpm?: number; value?: number }[],
  maxSec: number,
  maxVal: number,
  valueKey: 'wpm' | 'value'
): string {
  if (data.length === 0) return ''
  return data
    .map((d) => {
      const x = PAD.left + (d.second / maxSec) * PLOT_W
      const val = valueKey === 'wpm' ? d.wpm! : d.value!
      const y = PAD.top + PLOT_H - (val / maxVal) * PLOT_H
      return `${x},${y}`
    })
    .join(' ')
}

function pointsToPath(points: string): string {
  const pts = points.split(' ').filter(Boolean)
  if (pts.length === 0) return ''
  const [firstX, firstY] = pts[0]!.split(',')
  let d = `M ${firstX} ${firstY}`
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i]!.split(',')
    d += ` L ${x} ${y}`
  }
  return d
}

export default function SessionGraph({ timeline, durationSec }: SessionGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wpmPathRef = useRef<SVGPathElement>(null)
  const rawPathRef = useRef<SVGPathElement>(null)
  const momentumPathRef = useRef<SVGPathElement>(null)

  const maxSec = Math.max(durationSec, timeline.wpm[timeline.wpm.length - 1]?.second ?? 1)
  const maxWpm = Math.max(
    60,
    ...timeline.raw.map((d) => d.wpm),
    ...timeline.wpm.map((d) => d.wpm)
  )

  const maxMomentum = Math.max(
    100,
    ...timeline.momentum.map((d) => d.value),
    1
  )

  const rawPoints = buildPoints(timeline.raw, maxSec, maxWpm, 'wpm')
  const wpmPoints = buildPoints(timeline.wpm, maxSec, maxWpm, 'wpm')
  const momentumPoints = buildPoints(timeline.momentum, maxSec, maxMomentum, 'value')

  const rawPath = pointsToPath(rawPoints)
  const wpmPath = pointsToPath(wpmPoints)
  const momentumPath = pointsToPath(momentumPoints)

  const gridLines = 4
  const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => {
    const val = Math.round((maxWpm / gridLines) * i)
    const y = PAD.top + PLOT_H - (val / maxWpm) * PLOT_H
    return { val, y }
  })

  const xTicks = Math.min(maxSec, 6)
  const xTickValues = Array.from({ length: xTicks + 1 }, (_, i) => {
    const sec = Math.round((maxSec / xTicks) * i)
    const x = PAD.left + (sec / maxSec) * PLOT_W
    return { sec, x }
  })

  useEffect(() => {
    if (!containerRef.current) return
    const ctx = gsap.context(() => {
      const paths = [wpmPathRef.current, rawPathRef.current, momentumPathRef.current].filter(Boolean)
      for (const path of paths) {
        if (!path) continue
        const len = path.getTotalLength()
        gsap.set(path, { strokeDasharray: len, strokeDashoffset: len })
        gsap.to(path, {
          strokeDashoffset: 0,
          duration: 1.4,
          ease: 'power2.out',
          delay: 0.3,
        })
      }
      gsap.from('.session-graph-error', {
        opacity: 0,
        scale: 0,
        stagger: 0.05,
        duration: 0.3,
        ease: 'back.out(2)',
        delay: 1.0,
      })
    }, containerRef)
    return () => ctx.revert()
  }, [timeline])

  return (
    <div ref={containerRef} className="session-graph clean-card-sm stat-card p-4 flex flex-col gap-3">
      <p className="stat-label">pace over time</p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Session WPM and momentum graph"
      >
        {yTicks.map(({ val, y }) => (
          <g key={`y-${val}`}>
            <line
              x1={PAD.left}
              y1={y}
              x2={PAD.left + PLOT_W}
              y2={y}
              stroke="var(--border)"
              strokeWidth="1"
              opacity="0.4"
            />
            <text
              x={PAD.left - 6}
              y={y + 4}
              textAnchor="end"
              fontSize="9"
              fill="var(--text-stats)"
              fontFamily="var(--font-mono, monospace)"
            >
              {val}
            </text>
          </g>
        ))}

        {xTickValues.map(({ sec, x }) => (
          <g key={`x-${sec}`}>
            <line
              x1={x}
              y1={PAD.top}
              x2={x}
              y2={PAD.top + PLOT_H}
              stroke="var(--border)"
              strokeWidth="1"
              opacity="0.25"
            />
            <text
              x={x}
              y={H - 6}
              textAnchor="middle"
              fontSize="9"
              fill="var(--text-stats)"
              fontFamily="var(--font-mono, monospace)"
            >
              {sec}s
            </text>
          </g>
        ))}

        {momentumPoints && (
          <polygon
            points={`${PAD.left},${PAD.top + PLOT_H} ${momentumPoints} ${PAD.left + PLOT_W},${PAD.top + PLOT_H}`}
            fill="#8b5cf6"
            opacity="0.08"
          />
        )}

        {rawPath && (
          <path
            ref={rawPathRef}
            d={rawPath}
            fill="none"
            stroke="var(--text-stats)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.45"
          />
        )}

        {wpmPath && (
          <path
            ref={wpmPathRef}
            d={wpmPath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {momentumPath && (
          <path
            ref={momentumPathRef}
            d={momentumPath}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="4 3"
            opacity="0.85"
          />
        )}

        {timeline.errors.map((err, i) => {
          const x = PAD.left + (err.second / maxSec) * PLOT_W
          const y = PAD.top + PLOT_H - (err.wpm / maxWpm) * PLOT_H
          return (
            <circle
              key={i}
              className="session-graph-error"
              cx={x}
              cy={y}
              r="4"
              fill="var(--error)"
              stroke="var(--surface)"
              strokeWidth="1.5"
            />
          )
        })}

        <text
          x={W - 4}
          y={PAD.top + 8}
          textAnchor="end"
          fontSize="8"
          fill="#8b5cf6"
          fontFamily="var(--font-mono, monospace)"
        >
          mom
        </text>
        <text
          x={PAD.left - 2}
          y={PAD.top - 4}
          textAnchor="start"
          fontSize="8"
          fill="var(--text-stats)"
          fontFamily="var(--font-mono, monospace)"
        >
          wpm
        </text>
      </svg>

      <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs" style={{ color: 'var(--text-stats)' }}>
        <span>
          <span style={{ color: 'var(--text-stats)', opacity: 0.6 }}>—</span> raw
        </span>
        <span>
          <span style={{ color: 'var(--accent)' }}>—</span> wpm
        </span>
        <span>
          <span style={{ color: '#8b5cf6' }}>—</span> momentum
        </span>
        <span>
          <span style={{ color: 'var(--error)' }}>●</span> errors
        </span>
      </div>
    </div>
  )
}
