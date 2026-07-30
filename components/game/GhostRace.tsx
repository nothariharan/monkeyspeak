'use client'

import { useState, type CSSProperties } from 'react'
import Image from 'next/image'

interface GhostRaceProps {
  phase: 'idle' | 'running'
  playerProgress: number
  ghostProgress: number
  playerWpm: number
  ghostWpm: number
  duration: number
  /** True when the PB includes a usable progress timeline for replay. */
  hasReplay?: boolean
  onStart?: () => void
  onGoSpeed?: () => void
}

const clamp = (n: number) => Math.max(0, Math.min(100, n))

function TraceLane({
  kind,
  progress,
  wpm,
  label,
  hint,
  locked,
  live,
  valueText,
}: {
  kind: 'ghost' | 'you'
  progress: number
  wpm: number
  label: string
  hint: string
  locked?: boolean
  live?: boolean
  valueText?: string
}) {
  const pct = clamp(locked ? 0 : progress)
  const style = { '--race-progress': `${pct}%` } as CSSProperties
  const markerSrc = kind === 'ghost' ? '/ghost-race/ghost-marker.webp' : '/ghost-race/you-marker.webp'
  const ariaValueText =
    valueText ??
    (locked ? 'locked' : live ? `${Math.round(pct)} percent` : 'ready at start')

  return (
    <div
      className={`ghost-trace-lane ghost-trace-lane--${kind}${live ? ' is-live' : ''}${locked ? ' is-locked' : ''}`}
      style={style}
    >
      <div className="ghost-trace-lane-meta">
        <div className="ghost-trace-lane-copy">
          <span className="ghost-trace-lane-label">{label}</span>
          <span className="ghost-trace-lane-hint">{hint}</span>
        </div>
        <strong className="ghost-trace-lane-wpm">
          {wpm > 0 ? wpm : '—'} <small>wpm</small>
        </strong>
      </div>

      <div
        className="ghost-trace-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-valuetext={ariaValueText}
        aria-label={label}
      >
        <div className="ghost-trace-fill" />
        <div className="ghost-trace-marker" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ghost-trace-marker-img" src={markerSrc} alt="" width={40} height={40} decoding="async" />
        </div>
      </div>
    </div>
  )
}

export default function GhostRace({
  phase,
  playerProgress,
  ghostProgress,
  playerWpm,
  ghostWpm,
  duration,
  hasReplay = false,
  onStart,
  onGoSpeed,
}: GhostRaceProps) {
  const hasBest = ghostWpm > 0
  const canRaceGhost = hasBest && hasReplay
  const lead = playerProgress - ghostProgress
  const [liveExpanded, setLiveExpanded] = useState(false)

  if (phase === 'running') {
    const leadPct = Math.round(Math.abs(lead))
    const statusClass = !canRaceGhost ? '' : lead >= 0 ? 'is-ahead' : 'is-behind'
    const statusText = !hasBest
      ? 'no ghost yet — finish clean to seed the next race'
      : !hasReplay
        ? 'pace only — no replay timeline yet'
        : lead >= 0
          ? `ahead ${leadPct}%`
          : `behind ${leadPct}%`
    const chipText = !hasBest
      ? 'no ghost'
      : !hasReplay
        ? 'pace only'
        : lead >= 0
          ? `+${leadPct}%`
          : `−${leadPct}%`

    return (
      <section
        className={`ghost-trace ghost-trace--live${liveExpanded ? ' is-expanded' : ''}`}
        aria-label="Ghost Trace live race"
      >
        <button
          type="button"
          className="ghost-trace-live-chip"
          aria-expanded={liveExpanded}
          onClick={() => setLiveExpanded((open) => !open)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ghost-race/ghost-marker.webp" alt="" width={16} height={16} decoding="async" />
          <span className="ghost-trace-live-chip-label">live</span>
          <span className={`ghost-trace-live-chip-status ${statusClass}`}>{chipText}</span>
          <strong className="ghost-trace-live-chip-wpm">
            <span>{playerWpm || '—'}</span>
            <small>/</small>
            <span>{ghostWpm || '—'}</span>
          </strong>
        </button>

        <div className="ghost-trace-live-card paper-panel">
          <div className="ghost-trace-live-head">
            <span className="ghost-trace-live-tag">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ghost-race/ghost-marker.webp" alt="" width={18} height={18} decoding="async" />
              live trace
            </span>
            <span className="ghost-trace-live-meta">{duration}s</span>
          </div>

          <TraceLane
            kind="ghost"
            progress={ghostProgress}
            wpm={ghostWpm}
            label="ghost"
            hint={canRaceGhost ? 'replay' : hasBest ? 'no replay yet' : 'no ghost yet'}
            locked={!canRaceGhost}
            live
            valueText={!canRaceGhost ? (hasBest ? 'pace only, no replay' : 'locked') : undefined}
          />
          <TraceLane
            kind="you"
            progress={playerProgress}
            wpm={playerWpm}
            label="you"
            hint="live"
            live
          />

          <p className={`ghost-trace-status ${statusClass}`}>{statusText}</p>
        </div>
      </section>
    )
  }

  const ghostHint = !hasBest
    ? 'locked until you set a speed best'
    : hasReplay
      ? 'ready at start · saved replay'
      : 'pace only — no replay timeline yet'
  const youHint = hasBest ? 'ready at start' : 'ready at start'
  const introHint = !hasBest
    ? 'set a speed personal best first — then the ghost appears here.'
    : hasReplay
      ? `ghost locked at ${ghostWpm} wpm for this prompt · ${duration}s.`
      : `ghost pace ${ghostWpm} wpm saved · replay timeline missing for this board.`

  return (
    <section className="ghost-trace" aria-label="Ghost Trace">
      <header className="ghost-trace-intro">
        <div className="ghost-trace-intro-copy">
          <p className="ghost-trace-eyebrow">personal replay</p>
          <h1>
            race your <span>ghost</span>
          </h1>
          <p className="ghost-trace-lede">
            your best run becomes a living pace line. speak live, stay ahead, and overwrite the
            trace.
          </p>
          <p className="start-hint ghost-trace-intro-hint">{introHint}</p>
        </div>

        <div className="ghost-trace-mascot-wrap" aria-hidden="true">
          <Image
            src="/ghost-race/ghost-mascot.webp"
            alt=""
            width={180}
            height={180}
            priority
            sizes="(max-width: 720px) 96px, 180px"
            className="ghost-trace-mascot"
          />
          <span className="ghost-trace-scribble">
            beat
            <br />
            your best!
          </span>
        </div>
      </header>

      <div className="ghost-trace-workspace">
        <div className="ghost-trace-main paper-panel">
          <span className="hero-paper-tape hero-paper-tape--blue" aria-hidden>
            race
          </span>
          <div className="ghost-trace-card-header">
            <div>
              <p className="ghost-trace-step">01 · the dual lane</p>
              <h2>two paces. one prompt.</h2>
            </div>
            <span className="ghost-trace-duration-chip">{duration}s board</span>
          </div>

          <div className={`ghost-trace-stage${hasBest ? '' : ' is-empty'}`}>
            <div className="ghost-trace-stage-content">
              <TraceLane
                kind="ghost"
                progress={0}
                wpm={ghostWpm}
                label="ghost · your best"
                hint={ghostHint}
                locked={!hasBest}
                valueText={!hasBest ? 'locked' : hasReplay ? 'ready at start' : 'pace only, no replay'}
              />
              <TraceLane
                kind="you"
                progress={0}
                wpm={0}
                label="you · live mic"
                hint={youHint}
                valueText="ready at start"
              />
              <div className="ghost-trace-ticks" aria-hidden="true">
                <span>0s</span>
                <span>{Math.round(duration / 2)}s</span>
                <span>{duration}s</span>
              </div>
            </div>
          </div>

          <div className="ghost-trace-actions">
            {hasBest ? (
              <button
                className="hero-start-btn ghost-trace-start"
                type="button"
                onClick={onStart}
                id="btn-ghost-start"
              >
                start race
              </button>
            ) : (
              <div className="ghost-trace-action-stack">
                <button
                  className="hero-start-btn ghost-trace-start"
                  type="button"
                  onClick={onGoSpeed}
                  id="btn-ghost-set-best"
                >
                  set a speed best
                </button>
                <button
                  className="desk-btn desk-btn-quiet ghost-trace-start-quiet"
                  type="button"
                  onClick={onStart}
                  id="btn-ghost-start"
                >
                  race without ghost
                </button>
              </div>
            )}
            <p>
              {hasBest
                ? hasReplay
                  ? 'no sign-up. no account. just you vs. you.'
                  : 'race now to seed a replay timeline — or set a fresh speed best.'
                : 'set a speed best first — or race now to seed the ghost.'}
            </p>
          </div>
        </div>

        <aside className="ghost-trace-side paper-panel" aria-label="How ghost trace works">
          <span className="hero-paper-tape hero-paper-tape--orange" aria-hidden>
            how
          </span>
          <div className="ghost-trace-side-head">
            <div>
              <p className="ghost-trace-step">how it works</p>
              <h2>trace rules</h2>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="ghost-trace-side-badge"
              src="/ghost-race/ghost-trace-badge.png"
              alt=""
              width={38}
              height={38}
              decoding="async"
            />
          </div>

          <ol className="ghost-trace-steps">
            <li>
              <strong>1 · lock a speed best</strong>
              <small>same duration + prompt style fills the ghost lane.</small>
            </li>
            <li>
              <strong>2 · speak against the replay</strong>
              <small>
                {hasReplay
                  ? 'the ghost advances on your saved timeline — not a fake timer.'
                  : 'once a replay timeline is saved, the ghost follows your real pace line.'}
              </small>
            </li>
            <li>
              <strong>3 · finish ahead to rewrite it</strong>
              <small>beat the pace and the next race chases your new best.</small>
            </li>
          </ol>

          <div className={`ghost-trace-side-metric${hasBest ? '' : ' is-empty'}`}>
            <span>ghost pace</span>
            <b className="tabular-nums">{hasBest ? `${ghostWpm}` : '—'}</b>
            <small>
              {!hasBest ? 'no best yet' : hasReplay ? 'wpm · replay ready' : 'wpm · pace only'}
            </small>
          </div>
        </aside>
      </div>
    </section>
  )
}
