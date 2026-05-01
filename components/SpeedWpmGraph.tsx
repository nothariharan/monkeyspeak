'use client'

import type { SpeedTimelineEvent, WpmSnapshot } from '@/store/testStore'

interface SpeedWpmGraphProps {
  durationSec: number
  testStartedAt: number | null
  wpmSnapshots: WpmSnapshot[]
  speedTimelineEvents: SpeedTimelineEvent[]
  peakWpm: number
  currentWpm: number
}

const PAD = { l: 44, r: 36, t: 16, b: 32 }
const W = 520
const H = 220

export default function SpeedWpmGraph({
  durationSec,
  testStartedAt,
  wpmSnapshots,
  speedTimelineEvents,
  peakWpm,
  currentWpm,
}: SpeedWpmGraphProps) {
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b

  const yMax = Math.max(40, Math.ceil(Math.max(peakWpm, currentWpm) * 1.12))

  const toX = (sec: number) => PAD.l + (sec / Math.max(durationSec, 1)) * innerW
  const toY = (wpm: number) => PAD.t + innerH - (wpm / yMax) * innerH

  const points =
    testStartedAt != null && wpmSnapshots.length > 0
      ? wpmSnapshots
          .map((s) => {
            const sec = (s.timestamp - testStartedAt) / 1000
            return { sec, wpm: s.wpm }
          })
          .filter((p) => p.sec >= 0 && p.sec <= durationSec + 0.5)
      : []

  const d =
    points.length === 0
      ? ''
      : points
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.sec).toFixed(1)} ${toY(p.wpm).toFixed(1)}`)
          .join(' ')

  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((t) => PAD.t + innerH * (1 - t))

  return (
    <div className="w-full" aria-label="Words per minute over time">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto max-h-[280px]"
        role="img"
        style={{ color: 'var(--text-stats)' }}
      >
        {gridYs.map((gy) => (
          <line
            key={gy}
            x1={PAD.l}
            x2={W - PAD.r}
            y1={gy}
            y2={gy}
            stroke="currentColor"
            strokeOpacity={0.12}
            strokeWidth={1}
          />
        ))}
        <line
          x1={PAD.l}
          x2={PAD.l}
          y1={PAD.t}
          y2={H - PAD.b}
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeWidth={1}
        />
        <line
          x1={PAD.l}
          x2={W - PAD.r}
          y1={H - PAD.b}
          y2={H - PAD.b}
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeWidth={1}
        />

        {[0, Math.round(yMax / 2), yMax].map((yv) => (
          <text
            key={yv}
            x={PAD.l - 6}
            y={toY(yv) + 4}
            textAnchor="end"
            fontSize="11"
            fill="currentColor"
            fillOpacity={0.65}
          >
            {yv}
          </text>
        ))}

        <text x={PAD.l} y={H - 6} fontSize="11" fill="currentColor" fillOpacity={0.65}>
          0s
        </text>
        <text x={toX(durationSec / 2)} y={H - 6} fontSize="11" textAnchor="middle" fill="currentColor" fillOpacity={0.65}>
          {Math.round(durationSec / 2)}s
        </text>
        <text x={W - PAD.r} y={H - 6} fontSize="11" textAnchor="end" fill="currentColor" fillOpacity={0.65}>
          {durationSec}s
        </text>

        <text x={W / 2} y={12} textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity={0.8}>
          wpm
        </text>

        {d ? (
          <path
            d={d}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2.2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : (
          <text
            x={W / 2}
            y={H / 2}
            textAnchor="middle"
            fontSize="12"
            fill="currentColor"
            fillOpacity={0.45}
          >
            no samples yet
          </text>
        )}

        {testStartedAt != null &&
          speedTimelineEvents.map((ev, i) => {
            const sec = ev.atMs / 1000
            if (sec < 0 || sec > durationSec + 0.5) return null
            const x = toX(sec)
            const yBase = H - PAD.b + 2
            return (
              <g key={`${ev.kind}-${i}-${ev.atMs}`}>
                <line x1={x} x2={x} y1={PAD.t} y2={H - PAD.b} stroke="var(--error)" strokeOpacity={0.12} strokeWidth={1} />
                <text
                  x={x}
                  y={yBase - 4}
                  textAnchor="middle"
                  fontSize="13"
                  fill="var(--error)"
                  fontWeight="700"
                >
                  ×
                </text>
              </g>
            )
          })}
      </svg>
    </div>
  )
}
