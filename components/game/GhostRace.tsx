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

const clamp = (n: number) => Math.max(3, Math.min(91, n))

function Runner({ kind, progress, wpm }: { kind: 'ghost' | 'you'; progress: number; wpm: number }) {
  const style = { '--runner-progress': `${clamp(progress)}%` } as CSSProperties
  return <div className={`ghost-runner ghost-runner--${kind}`} style={style}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={kind === 'ghost' ? '/ghost-race/ghost-runner-v1.png' : '/ghost-race/monkey-runner-v1.png'} alt="" />
    <span className="ghost-runner-label">{wpm} wpm</span>
  </div>
}

export default function GhostRace({ phase, playerProgress, ghostProgress, playerWpm, ghostWpm, duration, onStart }: GhostRaceProps) {
  const hasBest = ghostWpm > 0
  const lead = playerProgress - ghostProgress

  return <section className={`ghost-race ${phase === 'running' ? 'ghost-race--live' : ''}`} aria-label="Ghost Race">
    {phase === 'idle' && (
      <div className="ghost-race-intro">
        <span className="ghost-race-checker">⚑</span>
        <div>
          <p className="ghost-race-kicker">personal replay</p>
          <h1>ghost race</h1>
          <p>race the rhythm of your best run. <span>beat your best.</span></p>
        </div>
      </div>
    )}

    {phase === 'idle' && <div className="ghost-race-notes">
      <article className="ghost-note ghost-note--blue"><b>your best <em>(ghost)</em></b><strong>{hasBest ? ghostWpm : '—'} <small>wpm</small></strong><span>{hasBest ? `${duration}s · saved replay pace` : 'set a speed best to unlock'}</span><i /></article>
      <div className="ghost-race-rule">one prompt. two performances.<br /><span>the ghost follows your saved pace.</span></div>
      <article className="ghost-note ghost-note--green"><b>current run <em>(you)</em></b><strong>{playerWpm || '—'} <small>wpm</small></strong><span>{duration}s · live microphone</span><i /></article>
    </div>}

    <div className={`ghost-race-art ${phase === 'running' ? 'ghost-race-art--live' : ''}`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="ghost-race-art-background" src="/ghost-race/track-background-v1.png" alt="" />
      <Runner kind="ghost" progress={phase === 'idle' ? 52 : ghostProgress} wpm={ghostWpm} />
      <Runner kind="you" progress={phase === 'idle' ? 34 : playerProgress} wpm={playerWpm} />
      <div className="ghost-art-ticks"><span>0s</span><span>{Math.round(duration / 2)}s</span><span>{duration}s</span></div>
    </div>

    {phase === 'running' ? <p className={`ghost-race-status ${lead >= 0 ? 'is-ahead' : ''}`}>{lead >= 0 ? 'you’re ahead — keep the rhythm.' : 'the ghost is ahead — find your pace.'}</p> : <div className="ghost-race-footer"><div className="ghost-how"><b>how it works</b><span>your best run plays back as a blue ghost.</span><span>speak live and stay ahead to set a new record.</span></div><button className="ghost-start" type="button" onClick={onStart}><span>🎙</span> start race</button><p>no sign-up. no account. just you vs. you.</p></div>}
  </section>
}
