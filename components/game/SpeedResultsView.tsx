'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { DiffWord, SessionTimeline } from '@/store/testStore'
import styles from './speedResults.module.css'

/*
  the post-test speed results screen. one component, two callers:
  - app/results-preview feeds it mock data for design sign-off
  - components/ResultsPanel feeds it the real run data
  styled to match the rest of monkeyspeak (mono type, clean cards, pixel mascot).
*/

export interface SpeedResultsViewProps {
  netWpm: number
  rawWpm: number
  accuracy: number
  consistency: number
  fillerCount: number
  wordsSpoken: number
  deltaWpm: number | null
  isPersonalBest?: boolean
  personalBestWpm?: number
  correct: number
  wrong: number
  missed: number
  total: number
  timeline: SessionTimeline
  durationSec: number
  streakDays: number
  // optional detailed breakdown
  diff?: DiffWord[]
  transcript?: string
  promptType?: string
  // actions
  onRetry: () => void
  onNext: () => void
  onPractice?: () => void
  onShare: () => void
  onHistory: () => void
}

const TAG_CLASS: Record<DiffWord['tag'], string> = {
  correct: 'diff-correct',
  substituted: 'diff-substituted',
  missed: 'diff-missed',
  added: 'diff-added',
}

const MONO = 'var(--font-mono)'

// ---- chart ----
const W = 760
const H = 320
const PAD_L = 46
const PAD_R = 18
const PAD_T = 22
const PAD_B = 40
const PLOT_W = W - PAD_L - PAD_R
const PLOT_H = H - PAD_T - PAD_B

function niceCeil(v: number) {
  if (v <= 20) return 20
  const step = v <= 120 ? 28 : 40
  return Math.ceil(v / step) * step
}

function PaceChart({ timeline, durationSec }: { timeline: SessionTimeline; durationSec: number }) {
  const you = timeline.wpm ?? []
  const raw = timeline.raw ?? []
  const momentum = timeline.momentum ?? []
  const errors = timeline.errors ?? []
  const windows = timeline.wordWindows ?? []

  const lastSec = Math.max(
    durationSec || 0,
    ...you.map((p) => p.second),
    ...raw.map((p) => p.second),
    1
  )
  const xMax = lastSec
  const maxVal = Math.max(
    1,
    ...you.map((p) => p.wpm),
    ...raw.map((p) => p.wpm),
    ...momentum.map((p) => p.value)
  )
  const yMax = niceCeil(maxVal)

  const xAtSec = (s: number) => PAD_L + (xMax === 0 ? 0 : s / xMax) * PLOT_W
  const yAt = (v: number) => PAD_T + (1 - v / yMax) * PLOT_H

  const line = (pts: { second: number; v: number }[]) =>
    pts.map((p) => `${xAtSec(p.second).toFixed(1)},${yAt(p.v).toFixed(1)}`).join(' ')

  const youPts = you.map((p) => ({ second: p.second, v: p.wpm }))
  const rawPts = raw.map((p) => ({ second: p.second, v: p.wpm }))
  const momPts = momentum.map((p) => ({ second: p.second, v: p.value }))

  const areaPath = youPts.length
    ? `${youPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAtSec(p.second).toFixed(1)} ${yAt(p.v).toFixed(1)}`).join(' ')} L ${xAtSec(youPts[youPts.length - 1]!.second).toFixed(1)} ${yAt(0).toFixed(1)} L ${xAtSec(youPts[0]!.second).toFixed(1)} ${yAt(0).toFixed(1)} Z`
    : ''

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(yMax * t))
  const xTickCount = 6
  const xTicks = Array.from({ length: xTickCount + 1 }, (_, i) => Math.round((xMax * i) / xTickCount))

  // up to 3 annotation bubbles from word windows, anchored to the you-series
  const yAtSec = (s: number) => {
    if (!youPts.length) return yAt(0)
    let best = youPts[0]!
    for (const p of youPts) if (Math.abs(p.second - s) < Math.abs(best.second - s)) best = p
    return yAt(best.v)
  }
  const bubbles = windows.slice(0, 3).map((w) => ({
    at: (w.startSecond + w.endSecond) / 2,
    label: w.label,
  }))

  return (
    <svg className={styles.chartArea} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Pace over time chart">
      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line x1={PAD_L} y1={yAt(t)} x2={W - PAD_R} y2={yAt(t)} stroke="color-mix(in srgb, var(--text-stats) 14%, transparent)" strokeWidth={1} strokeDasharray="2 5" />
          <text x={PAD_L - 10} y={yAt(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-stats)" style={{ fontFamily: MONO }}>{t}</text>
        </g>
      ))}
      {xTicks.map((s, i) => (
        <text key={`x${i}`} x={xAtSec(s)} y={H - PAD_B + 22} textAnchor="middle" fontSize={11} fill="var(--text-stats)" style={{ fontFamily: MONO }}>{s}s</text>
      ))}

      {areaPath && <path d={areaPath} fill="color-mix(in srgb, var(--accent) 10%, transparent)" />}

      {rawPts.length > 1 && <polyline points={line(rawPts)} fill="none" stroke="#9a9a9a" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
      {rawPts.map((p, i) => <circle key={`rd${i}`} cx={xAtSec(p.second)} cy={yAt(p.v)} r={2.6} fill="#9a9a9a" />)}

      {momPts.length > 1 && <polyline points={line(momPts)} fill="none" stroke="var(--success)" strokeWidth={2} strokeDasharray="6 5" strokeLinecap="round" />}

      {youPts.length > 1 && <polyline points={line(youPts)} fill="none" stroke="var(--accent)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />}
      {youPts.map((p, i) => <circle key={`yd${i}`} cx={xAtSec(p.second)} cy={yAt(p.v)} r={3} fill="var(--accent)" />)}

      {errors.map((e, i) => (
        <text key={`e${i}`} x={xAtSec(e.second)} y={yAt(0) + 4} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--error)">✕</text>
      ))}

      {bubbles.map((b, i) => {
        const bx = Math.max(52, Math.min(W - 52, xAtSec(b.at)))
        const by = Math.max(46, yAtSec(b.at) - 14)
        const words = b.label.split(' ')
        const lines = words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : words
        const bw = 96
        const bh = 18 + lines.length * 15
        return (
          <g key={`b${i}`} transform={`translate(${bx}, ${by})`}>
            <rect x={-bw / 2} y={-bh} width={bw} height={bh} rx={8} fill="var(--surface)" stroke="color-mix(in srgb, var(--border) 60%, transparent)" strokeWidth={1} />
            <path d="M -5 -5 L 3 6 L 8 -5 Z" fill="var(--surface)" stroke="color-mix(in srgb, var(--border) 60%, transparent)" strokeWidth={1} />
            {lines.map((l, j) => (
              <text key={j} x={0} y={-bh + 18 + j * 15} textAnchor="middle" fontSize={12} fill="var(--text-stats)" style={{ fontFamily: MONO }}>{l}</text>
            ))}
          </g>
        )
      })}
    </svg>
  )
}

function MetricCard({ cls, label, value, hint, icon }: { cls: string; label: string; value: string | number; hint: string; icon: React.ReactNode }) {
  return (
    <div className={`${styles.card} ${styles.metricCard}`}>
      <div className={styles.metricHead}>
        <span className={`${styles.metricIcon} ${cls}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
        </span>
        <span className={styles.label}>{label}</span>
      </div>
      <div className={styles.metricValue}>{value}</div>
      <div className={styles.metricHint}>{hint}</div>
    </div>
  )
}

export default function SpeedResultsView(props: SpeedResultsViewProps) {
  const {
    netWpm, rawWpm, accuracy, consistency, fillerCount, wordsSpoken,
    deltaWpm, isPersonalBest, personalBestWpm, correct, wrong, missed, total,
    timeline, durationSec, streakDays, diff, transcript, promptType,
    onRetry, onNext, onPractice, onShare, onHistory,
  } = props

  const [displayWpm, setDisplayWpm] = useState(0)
  const [showDetail, setShowDetail] = useState(false)
  const isDaily = (promptType ?? '').startsWith('daily')

  // count the wpm up on mount
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const dur = 1000
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayWpm(Math.round(netWpm * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [netWpm])

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

  const renderDelta = () => {
    if (deltaWpm === null) return <span className={styles.deltaLine} style={{ color: 'var(--text-muted)' }}>first run</span>
    if (deltaWpm === 0) return <span className={styles.deltaLine} style={{ color: 'var(--text-muted)' }}>even with last run</span>
    const up = deltaWpm > 0
    return <span className={styles.deltaLine} style={{ color: up ? 'var(--success)' : 'var(--error)' }}>{up ? '↑' : '↓'} {up ? '+' : ''}{deltaWpm} from last run</span>
  }

  return (
    <div className={styles.page}>
      {/* header */}
      <header className={styles.header}>
        <div className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={32} height={32} />
          <span>monkey<span className={styles.brandSpeak}>speak</span></span>
        </div>
        <div className={styles.headerBtns}>
          <button className="desk-btn desk-btn-quiet" type="button" onClick={onShare}>share</button>
          <button className="desk-btn desk-btn-quiet" type="button" onClick={onHistory}>history</button>
        </div>
      </header>

      <div className={styles.wrap}>
        {/* hero */}
        <section className={styles.heroRow}>
          <div className={styles.mascotWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.mascotImg} src="/mascot_pb.png" alt="MonkeySpeak mascot celebrating" />
            {isPersonalBest && <span className={styles.speechBubble}>nice one!</span>}
          </div>

          <div className={`${styles.card} ${styles.heroCard} ${styles.tape} ${styles.tapeGreen}`}>
            <div>
              {isPersonalBest ? (
                <span className={styles.pbBadge}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z" /></svg>
                  new personal best
                </span>
              ) : personalBestWpm ? (
                <span className={styles.label} style={{ display: 'block', marginBottom: '0.55rem' }}>best {personalBestWpm} wpm</span>
              ) : null}
              <div className={styles.wpmLine}>
                <span className={styles.wpmBig} aria-label={`${netWpm} words per minute`}>{displayWpm}</span>
                <span className={styles.wpmUnit}>wpm</span>
              </div>
              {renderDelta()}
            </div>

            <div className={styles.sessionMini}>
              <p className={`${styles.label} ${styles.miniTitle}`}>session complete</p>
              <div className={styles.miniRow}>
                <div className={styles.miniCell}>
                  <div className={styles.label}>avg wpm</div>
                  <div className={styles.miniVal}>{netWpm}</div>
                </div>
                <div className={styles.miniCell}>
                  <div className={styles.label}>accuracy</div>
                  <div className={styles.miniVal}>{accuracy}%</div>
                </div>
                <div className={styles.miniCell}>
                  <div className={styles.label}>consistency</div>
                  <div className={styles.miniVal}>{consistency}%</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* metrics */}
        <section className={styles.metrics}>
          <MetricCard cls={styles.iconAccuracy} label="accuracy" value={`${accuracy}%`} hint={accuracy >= 80 ? 'nice and sharp!' : 'keep it steady!'} icon={<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.6" /></>} />
          <MetricCard cls={styles.iconConsistency} label="consistency" value={`${consistency}%`} hint={consistency >= 70 ? 'smooth pace!' : 'good balance!'} icon={<polyline points="21 12 17 12 14 20 10 4 7 12 3 12" />} />
          <MetricCard cls={styles.iconRaw} label="raw wpm" value={rawWpm} hint="your top speed" icon={<><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 16 14" /></>} />
          <MetricCard cls={styles.iconWords} label="words spoken" value={wordsSpoken} hint="nice vocab!" icon={<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>} />
        </section>

        {/* fillers + chart */}
        <section className={styles.metricsSecond}>
          <MetricCard cls={styles.iconFillers} label="fillers" value={fillerCount} hint={fillerCount === 0 ? 'perfect! ✨' : 'trim the ums'} icon={<polygon points="12 2 15 9 22 9.3 17 14 18.2 21 12 17.5 5.8 21 7 14 2 9.3 9 9" />} />

          <div className={`${styles.card} ${styles.chartCard}`}>
            <p className={`${styles.label} ${styles.chartTitle}`}>pace over time</p>
            <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', gap: '0.5rem', alignItems: 'center' }}>
              <div className={styles.legend}>
                <div className={styles.legendRow}><svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" /></svg> you (wpm)</div>
                <div className={styles.legendRow}><svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#9a9a9a" strokeWidth="3" strokeLinecap="round" /></svg> raw wpm</div>
                <div className={styles.legendRow}><svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="var(--success)" strokeWidth="3" strokeDasharray="5 4" strokeLinecap="round" /></svg> momentum</div>
                <div className={styles.legendRow}><span style={{ color: 'var(--error)', fontWeight: 700, width: 24, textAlign: 'center' }}>✕</span> errors</div>
              </div>
              <PaceChart timeline={timeline} durationSec={durationSec} />
            </div>

            <div className={`${styles.cardDotted} ${styles.chartNotes}`}>
              <div className={styles.noteItem}><span style={{ color: 'var(--success)', fontSize: '1.1rem' }}>↗</span> {consistency >= 60 ? 'you kept a steady pace. nice!' : 'try to hold a steadier pace'}</div>
              <div className={styles.noteItem}><span style={{ color: 'var(--accent)', fontSize: '1.1rem' }}>〰</span> raw peak {rawWpm} wpm</div>
              <div className={styles.noteItem}><span style={{ color: 'var(--orange)', fontSize: '1.1rem' }}>★</span> {accuracy >= 70 ? 'strong accuracy! keep it up.' : 'read a touch slower for accuracy'}</div>
            </div>
          </div>
        </section>

        {/* breakdown */}
        <section className={`${styles.card} ${styles.breakdown}`}>
          <div className={styles.breakdownHead}>
            <span className={styles.label}>breakdown</span>
            <span className={styles.breakdownCount}>{correct} / {total} words</span>
          </div>
          <div className={styles.segBar}>
            {correct > 0 && <div className={`${styles.seg} ${styles.segCorrect}`} style={{ flex: correct }} />}
            {wrong > 0 && <div className={`${styles.seg} ${styles.segWrong}`} style={{ flex: wrong }} />}
            {missed > 0 && <div className={`${styles.seg} ${styles.segMissed}`} style={{ flex: missed }} />}
          </div>
          <div className={styles.legendBreakdown}>
            <span><span className={styles.swatchBox} style={{ background: 'var(--success)' }} />correct – {correct} ({pct(correct)}%)</span>
            <span><span className={styles.swatchBox} style={{ background: 'var(--error)' }} />wrong – {wrong} ({pct(wrong)}%)</span>
            <span><span className={styles.swatchBox} style={{ background: 'color-mix(in srgb, var(--text-stats) 45%, var(--bg))' }} />missed – {missed} ({pct(missed)}%)</span>
          </div>
        </section>

        {/* detailed breakdown (optional) */}
        {diff && diff.length > 0 && (
          <>
            <button
              type="button"
              className={`${styles.detailToggle} ${showDetail ? styles.detailToggleOpen : ''}`}
              onClick={() => setShowDetail((v) => !v)}
              aria-expanded={showDetail}
            >
              <span className="caret">▸</span> detailed breakdown
            </button>
            {showDetail && (
              <div className={styles.detailGrid}>
                <div className={`${styles.card} ${styles.detailBox}`}>
                  <p className={styles.label} style={{ marginBottom: '0.5rem' }}>expected · hover wrong words</p>
                  {diff.map((w, i) => (
                    <span
                      key={i}
                      className={`${styles.detailWord} ${TAG_CLASS[w.tag]}`}
                      title={w.tag === 'substituted' && w.expected ? `you said "${w.word}" · expected "${w.expected}"` : w.tag === 'missed' ? 'not captured' : w.tag}
                    >
                      {w.tag === 'substituted' ? w.expected ?? w.word : w.word}
                    </span>
                  ))}
                </div>
                <div className={`${styles.card} ${styles.detailBox}`}>
                  <p className={styles.label} style={{ marginBottom: '0.5rem' }}>you said · transcribed</p>
                  {transcript && transcript.trim()
                    ? transcript.trim().split(/\s+/).map((w, i) => <span key={i} className={styles.detailWord}>{w}</span>)
                    : <span style={{ color: 'var(--text-muted)' }}>nothing transcribed</span>}
                </div>
              </div>
            )}
          </>
        )}

        {/* what's next */}
        <section className={`${styles.cardDotted} ${styles.nextRow}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.nextHeadMascot} src="/mascot_head.png" alt="" />
          <span className={styles.nextLabel}>what&apos;s next?</span>
          <span className={styles.nextArrow}>→</span>
          <div className={styles.nextBtns}>
            {isDaily ? (
              <Link href="/" className="desk-btn desk-btn-primary text-center">back to challenges</Link>
            ) : (
              <>
                <button type="button" className="desk-btn desk-btn-primary" onClick={onRetry}>try again</button>
                <button type="button" className="desk-btn desk-btn-quiet" onClick={onNext}>new test</button>
                {onPractice && wrong + missed > 0 && (
                  <button type="button" className="desk-btn desk-btn-quiet" onClick={onPractice}>practice missed</button>
                )}
              </>
            )}
            <button type="button" className="desk-btn desk-btn-quiet" onClick={onShare}>share</button>
          </div>
        </section>

        {/* streak */}
        {streakDays > 0 && (
          <div className={styles.streakWrap}>
            <div className={`${styles.cardDotted} ${styles.streak}`}>
              <span>🔥 <span className={styles.streakStrong}>{streakDays} day{streakDays === 1 ? '' : 's'} streak</span></span>
              <span>keep it going!</span>
              <span className={styles.streakChevron}>›</span>
            </div>
          </div>
        )}

        {!isDaily && <p className={styles.kbdHint}>tab · retry &nbsp;&nbsp; enter · next</p>}

        {/* tips */}
        <section className={`${styles.cardDotted} ${styles.tips}`}>
          <span className={styles.tipsIcon}>💡</span>
          <span>
            <span className={styles.tipsBold}>tips:</span> speak clearly, stay consistent, and don&apos;t rush. small steps = big progress!
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.tipsMascot} src="/mascot_head.png" alt="" />
        </section>
      </div>
    </div>
  )
}
