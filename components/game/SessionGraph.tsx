'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import type { SessionTimeline } from '@/store/testStore'

interface SessionGraphProps {
  timeline: SessionTimeline
  durationSec: number
  /** smaller embed for the results hero column */
  compact?: boolean
  /** hide momentum trace when space is tight */
  showMomentum?: boolean
  /** override the full-size canvas height (default 200) */
  height?: number
}

const W = 640
const H_FULL = 200
const H_COMPACT = 148
const PAD_FULL = { top: 18, right: 52, bottom: 30, left: 46 }
const PAD_COMPACT = { top: 12, right: 30, bottom: 22, left: 34 }

interface Pt {
  x: number
  y: number
}

function toPath(pts: Pt[]): string {
  if (pts.length === 0) return ''
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i]!.x} ${pts[i]!.y}`
  return d
}

/** merged per-second row that feeds both the plot and the hover tooltip */
interface Row {
  second: number
  wpm: number
  raw: number
  momentum: number
  errors: number
  x: number
  wpmY: number
  rawY: number
}

export default function SessionGraph({
  timeline,
  durationSec,
  compact = false,
  showMomentum = true,
  height,
}: SessionGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const wpmPathRef = useRef<SVGPathElement>(null)
  const rawPathRef = useRef<SVGPathElement>(null)
  const momentumPathRef = useRef<SVGPathElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const H = compact ? H_COMPACT : height ?? H_FULL
  const PAD = compact ? PAD_COMPACT : PAD_FULL
  const PLOT_W = W - PAD.left - PAD.right
  const PLOT_H = H - PAD.top - PAD.bottom

  const maxSec = Math.max(durationSec, timeline.wpm[timeline.wpm.length - 1]?.second ?? 1)
  const maxWpm = Math.max(
    60,
    ...timeline.raw.map((d) => d.wpm),
    ...timeline.wpm.map((d) => d.wpm)
  )
  const maxMomentum = Math.max(100, ...timeline.momentum.map((d) => d.value), 1)

  // roll the raw error list up into a count per second — this is the
  // "how many mistakes in this section" signal monkeytype surfaces.
  const errorsBySecond = useMemo(() => {
    const m = new Map<number, number>()
    for (const e of timeline.errors) m.set(e.second, (m.get(e.second) ?? 0) + 1)
    return m
  }, [timeline.errors])

  const maxErrors = Math.max(0, ...Array.from(errorsBySecond.values()))
  const hasErrors = maxErrors > 0
  const errAxisMax = Math.max(1, maxErrors)

  const xForSec = (sec: number) => PAD.left + (sec / maxSec) * PLOT_W
  const yForWpm = (val: number) => PAD.top + PLOT_H - (val / maxWpm) * PLOT_H
  const yForErr = (count: number) => PAD.top + PLOT_H - (count / errAxisMax) * PLOT_H

  const rows: Row[] = useMemo(
    () =>
      timeline.wpm.map((w, i) => ({
        second: w.second,
        wpm: w.wpm,
        raw: timeline.raw[i]?.wpm ?? w.wpm,
        momentum: timeline.momentum[i]?.value ?? 0,
        errors: errorsBySecond.get(w.second) ?? 0,
        x: PAD.left + (w.second / maxSec) * PLOT_W,
        wpmY: PAD.top + PLOT_H - (w.wpm / maxWpm) * PLOT_H,
        rawY: PAD.top + PLOT_H - ((timeline.raw[i]?.wpm ?? w.wpm) / maxWpm) * PLOT_H,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeline, errorsBySecond, maxSec, maxWpm, PLOT_W, PLOT_H, PAD.left, PAD.top]
  )

  const wpmPts = rows.map((r) => ({ x: r.x, y: r.wpmY }))
  const rawPts = rows.map((r) => ({ x: r.x, y: r.rawY }))
  const momentumPts = showMomentum
    ? timeline.momentum.map((d) => ({
        x: xForSec(d.second),
        y: PAD.top + PLOT_H - (d.value / maxMomentum) * PLOT_H,
      }))
    : []

  const wpmPath = toPath(wpmPts)
  const rawPath = toPath(rawPts)
  const momentumPath = toPath(momentumPts)

  const errorMarks = Array.from(errorsBySecond.entries()).map(([second, count]) => ({
    second,
    count,
    x: xForSec(second),
    y: yForErr(count),
  }))

  const gridLines = compact ? 3 : 4
  const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => {
    const val = Math.round((maxWpm / gridLines) * i)
    return { val, y: yForWpm(val) }
  })

  const xTicks = Math.min(maxSec, compact ? 4 : 6)
  const xTickValues = Array.from({ length: xTicks + 1 }, (_, i) => {
    const sec = Math.round((maxSec / xTicks) * i)
    return { sec, x: xForSec(sec) }
  })

  // right-hand errors axis ticks — integers only
  const errTickCount = Math.min(errAxisMax, 4)
  const errTicks = hasErrors
    ? Array.from({ length: errTickCount + 1 }, (_, i) => {
        const val = Math.round((errAxisMax / errTickCount) * i)
        return { val, y: yForErr(val) }
      }).filter((t, i, arr) => arr.findIndex((o) => o.val === t.val) === i)
    : []

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
      gsap.from('.session-graph-dot', {
        opacity: 0,
        stagger: 0.02,
        duration: 0.4,
        ease: 'power1.out',
        delay: compact ? 0.5 : 0.7,
      })
      gsap.from('.session-graph-error', {
        opacity: 0,
        scale: 0,
        transformOrigin: 'center',
        stagger: 0.05,
        duration: 0.35,
        ease: 'back.out(2)',
        delay: compact ? 0.75 : 1.0,
      })
    }, containerRef)
    return () => ctx.revert()
  }, [timeline, compact])

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg || rows.length === 0) return
    const rect = svg.getBoundingClientRect()
    const vbX = ((e.clientX - rect.left) / rect.width) * W
    let nearest = 0
    let best = Infinity
    for (let i = 0; i < rows.length; i++) {
      const d = Math.abs(rows[i]!.x - vbX)
      if (d < best) {
        best = d
        nearest = i
      }
    }
    setHover(nearest)
  }

  const active = hover != null ? rows[hover] : null
  const tipLeftPct = active ? Math.min(88, Math.max(12, (active.x / W) * 100)) : 0

  return (
    <div
      ref={containerRef}
      className={`session-graph session-graph--embedded relative flex flex-col gap-3 ${compact ? 'session-graph--compact' : 'note-panel stat-card p-4'}`}
    >
      {!compact && (
        <div className="flex items-baseline justify-between">
          <p className="stat-label">pace over time</p>
          {hasErrors && (
            <p className="font-mono text-xs" style={{ color: 'var(--error)' }}>
              {timeline.errors.length} slip{timeline.errors.length === 1 ? '' : 's'}
            </p>
          )}
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Session WPM and error graph"
        onPointerMove={handleMove}
        onPointerLeave={() => setHover(null)}
        style={{ touchAction: 'none' }}
      >
        {/* word-window shaded bands — only in full-size view */}
        {!compact && timeline.wordWindows?.map(({ startSecond, endSecond, label }, i) => {
          const x = xForSec(startSecond)
          const w = Math.max(0, ((endSecond - startSecond) / maxSec) * PLOT_W)
          const midX = x + w / 2
          return (
            <g key={`ww-${i}`}>
              {i % 2 === 1 && (
                <rect x={x} y={PAD.top} width={w} height={PLOT_H} fill="var(--text-stats)" opacity="0.06" />
              )}
              <text
                x={midX}
                y={PAD.top + 9}
                textAnchor="middle"
                fontSize="7"
                fill="var(--text-stats)"
                fontFamily="var(--font-mono, monospace)"
                opacity="0.5"
              >
                {label}
              </text>
            </g>
          )
        })}

        {yTicks.map(({ val, y }) => (
          <g key={`y-${val}`}>
            <line x1={PAD.left} y1={y} x2={PAD.left + PLOT_W} y2={y} stroke="var(--border)" strokeWidth="1" opacity="0.35" />
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

        {/* right-hand errors axis */}
        {!compact && hasErrors && errTicks.map(({ val, y }) => (
          <text
            key={`err-${val}`}
            x={PAD.left + PLOT_W + 7}
            y={y + 4}
            textAnchor="start"
            fontSize="9"
            fill="var(--error)"
            fontFamily="var(--font-mono, monospace)"
            opacity="0.75"
          >
            {val}
          </text>
        ))}

        {xTickValues.map(({ sec, x }) => (
          <g key={`x-${sec}`}>
            <line x1={x} y1={PAD.top} x2={x} y2={PAD.top + PLOT_H} stroke="var(--border)" strokeWidth="1" opacity="0.2" />
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

        {showMomentum && momentumPath && (
          <polygon
            points={`${PAD.left},${PAD.top + PLOT_H} ${momentumPts.map((p) => `${p.x},${p.y}`).join(' ')} ${PAD.left + PLOT_W},${PAD.top + PLOT_H}`}
            fill="var(--accent)"
            opacity="0.07"
          />
        )}

        {/* hover crosshair sits under the traces */}
        {active && (
          <line
            x1={active.x}
            y1={PAD.top}
            x2={active.x}
            y2={PAD.top + PLOT_H}
            stroke="var(--accent)"
            strokeWidth="1"
            opacity="0.4"
            strokeDasharray="3 3"
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
            strokeDasharray="5 4"
            opacity="0.5"
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
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1 4"
            opacity="0.6"
          />
        )}

        {/* wpm sample dots */}
        {!compact && rows.map((r, i) => (
          <circle
            key={`dot-${i}`}
            className="session-graph-dot"
            cx={r.x}
            cy={r.wpmY}
            r={active === r ? 3.5 : 2}
            fill="var(--accent)"
            stroke="var(--surface)"
            strokeWidth="1"
          />
        ))}

        {/* per-second error crosses on the right axis */}
        {errorMarks.map((m, i) => {
          const s = compact ? 3 : 4
          return (
            <g key={`err-mark-${i}`} className="session-graph-error">
              <line x1={m.x - s} y1={m.y - s} x2={m.x + s} y2={m.y + s} stroke="var(--error)" strokeWidth="2" strokeLinecap="round" />
              <line x1={m.x - s} y1={m.y + s} x2={m.x + s} y2={m.y - s} stroke="var(--error)" strokeWidth="2" strokeLinecap="round" />
            </g>
          )
        })}
      </svg>

      {/* hover tooltip */}
      {active && (
        <div
          className="pointer-events-none absolute z-10 font-mono note-panel"
          style={{
            left: `${tipLeftPct}%`,
            top: compact ? 4 : 34,
            transform: 'translateX(-50%)',
            padding: '6px 9px',
            fontSize: '11px',
            lineHeight: 1.5,
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ color: 'var(--text-active)', fontWeight: 700 }}>{active.second}s</div>
          <div style={{ color: 'var(--accent)' }}>wpm · {active.wpm}</div>
          <div style={{ color: 'var(--text-stats)' }}>raw · {active.raw}</div>
          <div style={{ color: active.errors > 0 ? 'var(--error)' : 'var(--text-muted)' }}>
            errors · {active.errors}
          </div>
        </div>
      )}

      {!compact && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs" style={{ color: 'var(--text-stats)' }}>
          <span>
            <span style={{ color: 'var(--accent)' }}>—</span> wpm
          </span>
          <span>
            <span style={{ color: 'var(--text-stats)', opacity: 0.55 }}>- -</span> raw
          </span>
          {showMomentum && (
            <span>
              <span style={{ color: 'var(--accent-muted)' }}>··</span> momentum
            </span>
          )}
          <span>
            <span style={{ color: 'var(--error)', fontWeight: 700 }}>✕</span> errors
          </span>
        </div>
      )}
    </div>
  )
}
