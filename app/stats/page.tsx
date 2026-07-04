'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import ProfileHub from '@/components/ProfileHub'
import SettingsPanel from '@/components/SettingsPanel'
import { useTestStore, type SessionHistoryEntry } from '@/store/testStore'

// ─── Lightweight SVG Line Chart Component ─────────────────────────────────────

function StatsLineChart({
  data,
  valueKey,
  label,
  accentColor,
  yMin = 0,
  yMaxDefault = 100,
}: {
  data: SessionHistoryEntry[]
  valueKey: 'netWpm' | 'accuracy' | 'consistency'
  label: string
  accentColor: string
  yMin?: number
  yMaxDefault?: number
}) {
  const points = useMemo(() => {
    if (data.length === 0) return []
    return data.map((d, index) => ({
      x: index,
      y: Number(d[valueKey] ?? 0),
    }))
  }, [data, valueKey])

  if (data.length === 0) {
    return (
      <div className="stats-card flex flex-col gap-2">
        <p className="stat-label">{label}</p>
        <div className="stats-empty">not enough sessions to plot trend</div>
      </div>
    )
  }

  const W = 600
  const H = 160
  const PAD = { top: 12, right: 16, bottom: 20, left: 32 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const maxVal = Math.max(yMaxDefault, ...points.map((p) => p.y))
  const minVal = yMin

  const maxIndex = Math.max(1, points.length - 1)

  const chartPoints = points.map((p) => {
    const x = PAD.left + (p.x / maxIndex) * plotW
    const yRange = maxVal - minVal
    const yRatio = yRange > 0 ? (p.y - minVal) / yRange : 0.5
    const y = PAD.top + plotH - yRatio * plotH
    return `${x},${y}`
  })

  const pathD = chartPoints.length > 0 ? `M ${chartPoints.join(' L ')}` : ''

  const gridTicks = 3
  const yTicks = Array.from({ length: gridTicks + 1 }, (_, i) => {
    const val = Math.round(minVal + ((maxVal - minVal) / gridTicks) * i)
    const y = PAD.top + plotH - ((val - minVal) / (maxVal - minVal)) * plotH
    return { val, y }
  })

  return (
    <div className="stats-card flex flex-col gap-2">
      <p className="stat-label">{label}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {yTicks.map(({ val, y }) => (
          <g key={val}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="var(--border)" strokeWidth="1" opacity="0.3" strokeDasharray="3 3" />
            <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize="8" fill="var(--text-stats)" fontFamily="var(--font-mono, monospace)" opacity="0.7">
              {val}
            </text>
          </g>
        ))}

        {pathD && (
          <>
            <path
              d={`${pathD} L ${PAD.left + plotW} ${PAD.top + plotH} L ${PAD.left} ${PAD.top + plotH} Z`}
              fill={accentColor}
              opacity="0.08"
            />
            <path d={pathD} fill="none" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {points.map((p, idx) => {
              const [x, y] = chartPoints[idx]!.split(',')
              return (
                <circle
                  key={idx}
                  cx={x}
                  cy={y}
                  r="3.5"
                  fill="var(--surface)"
                  stroke={accentColor}
                  strokeWidth="2"
                  className="hover:scale-150 transition-transform cursor-pointer"
                >
                  <title>{`Run ${idx + 1}: ${p.y}`}</title>
                </circle>
              )
            })}
          </>
        )}
      </svg>
    </div>
  )
}

// ─── Lightweight SVG Bar Chart Component ──────────────────────────────────────

function StatsBarChart({
  data,
  accentColor,
  label,
}: {
  data: { label: string; value: number }[]
  accentColor: string
  label: string
}) {
  if (data.length === 0) {
    return (
      <div className="stats-card flex flex-col gap-2">
        <p className="stat-label">{label}</p>
        <div className="stats-empty">no weekly filler data to display</div>
      </div>
    )
  }

  const W = 600
  const H = 160
  const PAD = { top: 12, right: 16, bottom: 28, left: 32 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const maxVal = Math.max(1, ...data.map((d) => d.value))
  const barWidth = Math.max(6, Math.min(24, (plotW / data.length) * 0.5))
  const spacing = (plotW - barWidth * data.length) / Math.max(1, data.length - 1)

  return (
    <div className="stats-card flex flex-col gap-2">
      <p className="stat-label">{label}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0, 0.5, 1].map((ratio) => {
          const val = Math.round(maxVal * ratio * 10) / 10
          const y = PAD.top + plotH - ratio * plotH
          return (
            <g key={ratio}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="var(--border)" strokeWidth="1" opacity="0.3" />
              <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize="8" fill="var(--text-stats)" fontFamily="var(--font-mono, monospace)" opacity="0.7">
                {val}
              </text>
            </g>
          )
        })}

        {data.map((d, index) => {
          const x = PAD.left + index * (barWidth + spacing)
          const hRatio = d.value / maxVal
          const h = hRatio * plotH
          const y = PAD.top + plotH - h

          return (
            <g key={index}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(2, h)}
                rx="2"
                fill={`${accentColor}25`}
                stroke={accentColor}
                strokeWidth="1.5"
                className="hover:opacity-80 transition-opacity"
              />
              <text
                x={x + barWidth / 2}
                y={PAD.top + plotH + 12}
                textAnchor="middle"
                fontSize="7"
                fill="var(--text-stats)"
                fontFamily="var(--font-mono, monospace)"
              >
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StatsPage() {
  const { settings } = useTestStore()
  const [profileOpen, setProfileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const history = useMemo(() => {
    return [...(settings.sessionHistory ?? [])].reverse()
  }, [settings.sessionHistory])

  const activeColor = settings.accentHex || '#3b82f6'

  const speedHistory = useMemo(() => {
    return history.filter((h) => h.mode === 'speed')
  }, [history])

  const weeklyFillers = useMemo(() => {
    const speedRuns = history.filter((h) => h.mode === 'speed')
    if (speedRuns.length === 0) return []

    const getSundayStr = (dateStr: string) => {
      try {
        const d = new Date(dateStr)
        const day = d.getDay()
        const diff = d.getDate() - day
        const sunday = new Date(d.setDate(diff))
        const month = String(sunday.getMonth() + 1).padStart(2, '0')
        const date = String(sunday.getDate()).padStart(2, '0')
        return `${month}/${date}`
      } catch {
        return 'Week'
      }
    }

    const weeks: Record<string, { totalFillers: number; count: number }> = {}
    for (const run of speedRuns) {
      const weekKey = getSundayStr(run.date)
      if (!weeks[weekKey]) {
        weeks[weekKey] = { totalFillers: 0, count: 0 }
      }
      weeks[weekKey].totalFillers += run.fillerCount
      weeks[weekKey].count += 1
    }

    return Object.entries(weeks).map(([label, w]) => ({
      label,
      value: Math.round((w.totalFillers / w.count) * 10) / 10,
    }))
  }, [history])

  const mostMissedWords = useMemo(() => {
    const freq: Record<string, number> = {}
    let hasData = false

    for (const run of history) {
      if (run.missedWords && run.missedWords.length > 0) {
        hasData = true
        for (const w of run.missedWords) {
          const clean = w.toLowerCase().replace(/[^a-z0-9']/g, '').trim()
          if (!clean) continue
          freq[clean] = (freq[clean] ?? 0) + 1
        }
      }
    }

    if (!hasData) return []

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [history])

  const maxWpm = Object.values(settings.personalBests ?? {}).reduce(
    (max, pb) => Math.max(max, pb.wpm),
    0
  )

  const speedRunsCount = speedHistory.length
  const avgWpm = speedRunsCount > 0
    ? Math.round(speedHistory.reduce((sum, h) => sum + h.netWpm, 0) / speedRunsCount)
    : 0

  const avgAccuracy = history.length > 0
    ? Math.round(history.reduce((sum, h) => sum + h.accuracy, 0) / history.length)
    : 0

  if (!mounted) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header onSettingsOpen={() => setSettingsOpen(true)} onProfileOpen={() => setProfileOpen(true)} />
        <main className="flex-1 flex items-center justify-center px-6 py-8 mx-auto w-full max-w-4xl">
          <p className="stats-page-subtitle animate-pulse">loading your stats…</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header onSettingsOpen={() => setSettingsOpen(true)} onProfileOpen={() => setProfileOpen(true)} />

      <main className="flex-1 flex flex-col px-6 py-8 mx-auto w-full max-w-4xl gap-8">
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col">
            <h1 className="stats-page-title">
              chimp stats & analytics 📊
            </h1>
            <p className="stats-page-subtitle">
              visualize your voice progression, speed trend lines, and speech patterns.
            </p>
          </div>
          <Link href="/">
            <button type="button" className="desk-btn desk-btn-primary text-xs px-4 py-2">
              ← back to test
            </button>
          </Link>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'total runs', value: settings.lifetimeStats?.totalRuns ?? history.length },
            { label: 'avg wpm', value: `${avgWpm} wpm` },
            { label: 'max wpm', value: `${maxWpm > 0 ? maxWpm : '—'} wpm` },
            { label: 'avg accuracy', value: `${avgAccuracy}%` },
          ].map(({ label, value }) => (
            <div key={label} className="stats-metric">
              <p className="stat-label">{label}</p>
              <p className="stat-value text-base">{value}</p>
            </div>
          ))}
        </section>

        <section className="flex flex-col md:grid md:grid-cols-2 gap-4">
          <StatsLineChart
            data={speedHistory}
            valueKey="netWpm"
            label="wpm trend line (speed runs)"
            accentColor={activeColor}
            yMin={40}
            yMaxDefault={120}
          />

          <StatsLineChart
            data={speedHistory.filter((h) => typeof h.consistency === 'number')}
            valueKey="consistency"
            label="consistency curve (%)"
            accentColor={activeColor}
            yMin={50}
            yMaxDefault={100}
          />

          <StatsBarChart
            data={weeklyFillers}
            accentColor={activeColor}
            label="weekly filler frequency (avg fillers / session)"
          />

          <div className="stats-card flex flex-col gap-2">
            <p className="stat-label">most commonly missed words</p>
            {mostMissedWords.length === 0 ? (
              <div className="stats-empty">
                missed words analytics will populate as you complete tests.
              </div>
            ) : (
              <div className="flex flex-col">
                {mostMissedWords.map(([word, count], index) => (
                  <div key={word} className="stats-row text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="stat-label text-[10px]">#{index + 1}</span>
                      <span className="font-semibold truncate" style={{ color: 'var(--text-active)' }}>
                        {word}
                      </span>
                    </div>
                    <span className="stats-chip shrink-0" style={{ color: activeColor }}>
                      missed {count}x
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <footer className="text-center stats-page-subtitle py-4">
          MonkeyStats · visual progress trackers are stored locally in your browser storage.
        </footer>
      </main>

      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ProfileHub isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  )
}
