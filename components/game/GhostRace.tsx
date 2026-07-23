'use client'

import type { CSSProperties } from 'react'

interface GhostRaceProps {
  phase: 'idle' | 'running'
  playerProgress: number
  ghostProgress: number
  playerWpm: number
  ghostWpm: number
  duration: number
  onStart?: () => void
}

const clamp = (n: number) => Math.max(0, Math.min(100, n))

function RaceLoader({
  kind,
  progress,
  wpm,
  label,
  hint,
}: {
  kind: 'ghost' | 'you'
  progress: number
  wpm: number
  label: string
  hint: string
}) {
  const pct = clamp(progress)
  const style = { '--race-progress': `${pct}%` } as CSSProperties
  const icon = kind === 'ghost' ? '👻' : '🙊'

  return (
    <div className={`ghost-loader ghost-loader--${kind}`} style={style}>
      <div className="ghost-loader-meta">
        <span className="ghost-loader-label">{label}</span>
        <span className="ghost-loader-hint">{hint}</span>
        <strong className="ghost-loader-wpm">
          {wpm > 0 ? wpm : '—'} <small>wpm</small>
        </strong>
      </div>

      <div className="ghost-loader-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label}>
        <div className="ghost-loader-fill" />
        <div className="ghost-loader-marker" aria-hidden="true">
          <span className="ghost-loader-orb">{icon}</span>
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
  onStart,
}: GhostRaceProps) {
  const hasBest = ghostWpm > 0
  const lead = playerProgress - ghostProgress
  const idleGhost = hasBest ? 62 : 18
  const idleYou = hasBest ? 38 : 12

  return (
    <section className={`ghost-race ${phase === 'running' ? 'ghost-race--live' : ''}`} aria-label="Ghost Race">
      {phase === 'idle' && (
        <header className="ghost-race-intro">
          <p className="ghost-race-kicker">personal replay</p>
          <h1>ghost race</h1>
          <p>
            race the rhythm of your best run. <span>beat your best.</span>
          </p>
        </header>
      )}

      <div className={`ghost-race-stage ${phase === 'running' ? 'ghost-race-stage--live' : ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ghost-race-stage-bg" src="/ghost-race/track-background-v2.png" alt="" />
        <div className="ghost-race-stage-veil" aria-hidden="true" />

        <div className="ghost-race-stage-content">
          <div className="ghost-race-stage-head">
            <span>{phase === 'running' ? 'live race' : 'two paces. one prompt.'}</span>
            <span>{duration}s</span>
          </div>

          <RaceLoader
            kind="ghost"
            progress={phase === 'idle' ? idleGhost : ghostProgress}
            wpm={ghostWpm}
            label="ghost · your best"
            hint={hasBest ? 'saved replay pace' : 'set a speed best to unlock'}
          />
          <RaceLoader
            kind="you"
            progress={phase === 'idle' ? idleYou : playerProgress}
            wpm={playerWpm}
            label="you · live mic"
            hint={phase === 'running' ? 'speaking now' : 'this run'}
          />

          <div className="ghost-race-stage-ticks" aria-hidden="true">
            <span>0s</span>
            <span>{Math.round(duration / 2)}s</span>
            <span>{duration}s</span>
          </div>
        </div>
      </div>

      {phase === 'running' ? (
        <p className={`ghost-race-status ${lead >= 0 ? 'is-ahead' : ''}`}>
          {lead >= 0 ? 'you’re ahead — keep the rhythm.' : 'the ghost is ahead — find your pace.'}
        </p>
      ) : (
        <footer className="ghost-race-footer">
          <div className="ghost-how">
            <b>how it works</b>
            <span>your best run fills the ghost bar.</span>
            <span>speak live and stay ahead to set a new record.</span>
          </div>
          <button className="ghost-start" type="button" onClick={onStart}>
            <span>🎙</span> start race
          </button>
          <p>no sign-up. no account. just you vs. you.</p>
        </footer>
      )}
    </section>
  )
}
