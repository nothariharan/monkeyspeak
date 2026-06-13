'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import type { SessionTimeline } from '@/store/testStore'

interface SessionGraphProps {
  timeline: SessionTimeline
  durationSec: number
  /** smaller embed for the results hero column */
  compact?: boolean
  /** hide momentum trace when space is tight */
  showMomentum?: boolean
}

const W = 640
const H_FULL = 200
const H_COMPACT = 148
const PAD_FULL = { top: 16, right: 48, bottom: 28, left: 44 }
const PAD_COMPACT = { top: 10, right: 12, bottom: 22, left: 34 }

function buildPoints(
  data: { second: number; wpm?: number; value?: number }[],
  maxSec: number,
  maxVal: number,
  valueKey: 'wpm' | 'value',
  pad: typeof PAD_FULL,
  plotW: number,
  plotH: number
): string {
  if (data.length === 0) return ''
  return data
    .map((d) => {
      const x = pad.left + (d.second / maxSec) * plotW
      const val = valueKey === 'wpm' ? d.wpm! : d.value!
      const y = pad.top + plotH - (val / maxVal) * plotH
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

export default function SessionGraph({
  timeline,
  durationSec,
  compact = false,
  showMomentum = true,
}: SessionGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wpmPathRef = useRef<SVGPathElement>(null)
  const rawPathRef = useRef<SVGPathElement>(null)
  const momentumPathRef = useRef<SVGPathElement>(null)

  const H = compact ? H_COMPACT : H_FULL
  const PAD = compact ? PAD_COMPACT : PAD_FULL
  const PLOT_W = W - PAD.left - PAD.right
  const PLOT_H = H - PAD.top - PAD.bottom

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

  const rawPoints = buildPoints(timeline.raw, maxSec, maxWpm, 'wpm', PAD, PLOT_W, PLOT_H)
  const wpmPoints = buildPoints(timeline.wpm, maxSec, maxWpm, 'wpm', PAD, PLOT_W, PLOT_H)
  const momentumPoints = showMomentum
    ? buildPoints(timeline.momentum, maxSec, maxMomentum, 'value', PAD, PLOT_W, PLOT_H)
    : ''

  const rawPath = pointsToPath(rawPoints)
  const wpmPath = pointsToPath(wpmPoints)
  const momentumPath = pointsToPath(momentumPoints)

  const gridLines = compact ? 3 : 4
  const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => {
    const val = Math.round((maxWpm / gridLines) * i)
    const y = PAD.top + PLOT_H - (val / maxWpm) * PLOT_H
    return { val, y }
  })

  const xTicks = Math.min(maxSec, compact ? 4 : 6)
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
          duration: compact ? 1.05 : 1.4,
          ease: 'power2.out',
          delay: 0.25,
        })
      }
      gsap.from('.session-graph-error', {
        opacity: 0,
        scale: 0,
        stagger: 0.05,
        duration: 0.3,
        ease: 'back.out(2)',
        delay: compact ? 0.75 : 1.0,
      })
    }, containerRef)
    return () => ctx.revert()
  }, [timeline, compact])

  return (
    <div
      ref={containerRef}
      className={`session-graph session-graph--embedded flex flex-col gap-3 ${compact ? 'session-graph--compact' : 'note-panel stat-card p-4'}`}
    >
      <p className="stat-label">pace over time</p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Session WPM graph"
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
              opacity="0.35"
            />
            {!compact && (
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
            )}
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
              opacity="0.2"
            />
            <text
              x={x}
              y={H - 6}
              textAnchor="middle"
              fontSize={compact ? '8' : '9'}
              fill="var(--text-stats)"
              fontFamily="var(--font-mono, monospace)"
            >
              {sec}s
            </text>
          </g>
        ))}

        {showMomentum && momentumPoints && (
          <polygon
            points={`${PAD.left},${PAD.top + PLOT_H} ${momentumPoints} ${PAD.left + PLOT_W},${PAD.top + PLOT_H}`}
            fill="var(--accent)"
            opacity="0.07"
          />
        )}

        {rawPath && (
          <path
            ref={rawPathRef}
            d={rawPath}
            fill="none"
            stroke="var(--text-stats)"
            strokeWidth={compact ? '1.25' : '1.5'}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.4"
          />
        )}

        {wpmPath && (
          <path
            ref={wpmPathRef}
            d={wpmPath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={compact ? '2.25' : '2.5'}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {showMomentum && momentumPath && (
          <path
            ref={momentumPathRef}
            d={momentumPath}
            fill="none"
            stroke="var(--accent-muted)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="4 3"
            opacity="0.75"
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
              r={compact ? '3.5' : '4'}
              fill="var(--error)"
              stroke="var(--surface)"
              strokeWidth="1.5"
            />
          )
        })}
      </svg>

      {!compact && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs" style={{ color: 'var(--text-stats)' }}>
          <span>
            <span style={{ color: 'var(--text-stats)', opacity: 0.55 }}>-</span> raw
          </span>
          <span>
            <span style={{ color: 'var(--accent)' }}>-</span> wpm
          </span>
          {showMomentum && (
            <span>
              <span style={{ color: 'var(--accent-muted)' }}>-</span> momentum
            </span>
          )}
          <span>
            <span style={{ color: 'var(--error)' }}>●</span> errors
          </span>
        </div>
      )}
    </div>
  )
}
