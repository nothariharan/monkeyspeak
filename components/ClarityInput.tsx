'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import type { DiffWord } from '@/store/testStore'
import { useClarityLeaderboard } from '@/hooks/useClarityLeaderboard'
import { CLARITY_TOOLS } from '@/lib/clarityLeaderboard/tools'

interface ClarityInputProps {
  testState: 'idle' | 'running' | 'ended'
  transcript: string
  diffResult: DiffWord[]
  prompt: string[]
  onChange: (val: string) => void
  onStop: () => void
  onStart: (tool: { id: string; name: string }) => void
}

const TOOLS = CLARITY_TOOLS

export default function ClarityInput({ testState, transcript, prompt, onChange, onStop, onStart }: ClarityInputProps) {
  const [tool, setTool] = useState(TOOLS[0].id)
  const [customToolName, setCustomToolName] = useState('')
  const { rows: leaders, loading: leadersLoading, error: leadersError } = useClarityLeaderboard()
  const selectedTool = useMemo(() => tool === 'custom'
    ? { id: 'custom', name: customToolName.trim() || 'Your transcription tool', icon: null }
    : TOOLS.find((item) => item.id === tool) ?? TOOLS[0], [tool, customToolName])
  const wordCount = prompt.length
  const punctuationCount = prompt.join(' ').match(/[,.!?;:—']/g)?.length ?? 0

  const startTool = () => {
    const id = selectedTool.id === 'custom'
      ? `custom-${selectedTool.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'tool'}`
      : selectedTool.id
    onStart({ id, name: selectedTool.name })
  }

  return (
    <section className="clarity-benchmark" aria-label="Speech-to-text clarity benchmark">
      <header className="clarity-intro">
        <div className="clarity-intro-copy">
          <p className="clarity-eyebrow">speech-to-text check</p>
          <h1>how clear can it <span>hear?</span></h1>
          <p>
            pick a tool, read the prompt out loud, paste what it wrote — then see if it caught the whole thought.
          </p>
          <p className="start-hint clarity-intro-hint">
            your mic stays with the tool. monkeyspeak only scores the paste.
          </p>
        </div>
        <div className="clarity-mascot-wrap" aria-hidden="true">
          <Image src="/speak_mon.png" alt="" width={220} height={220} priority className="clarity-mascot" />
          <span className="clarity-scribble">say it<br />exactly!</span>
        </div>
      </header>

      <div className="clarity-workspace">
        <div className="clarity-main-card paper-panel">
          <div className="clarity-card-header">
            <div>
              <p className="clarity-step">01 · pick a tool</p>
              <h2>which engine are you testing?</h2>
            </div>
            <label className="tool-select-label">
              {selectedTool.icon ? <img src={selectedTool.icon} alt="" className="tool-logo tool-logo--select" /> : <span className="chatgpt-voice-icon" aria-hidden />}
              <select value={tool} onChange={(event) => setTool(event.target.value)} disabled={testState !== 'idle'} aria-label="Speech-to-text tool">
                {TOOLS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                <option value="custom">Your transcription tool</option>
              </select>
            </label>
          </div>

          <div className="tool-roster" aria-label="Available benchmark tools">
            {TOOLS.map((item) => (
              <button key={item.id} type="button" className={tool === item.id ? 'tool-choice is-active' : 'tool-choice'} onClick={() => setTool(item.id)} disabled={testState !== 'idle'} aria-pressed={tool === item.id}>
                {item.icon ? <img src={item.icon} alt="" className="tool-logo" /> : <span className="chatgpt-voice-icon" aria-hidden />}
                <span><strong>{item.name}</strong><small>{item.blurb}</small></span>
              </button>
            ))}
            <button type="button" className={tool === 'custom' ? 'tool-choice is-active' : 'tool-choice'} onClick={() => setTool('custom')} disabled={testState !== 'idle'}>
              <span className="tool-add-icon">+</span><span><strong>add your own</strong><small>otter, assembly, …</small></span>
            </button>
          </div>
          {tool === 'custom' && (
            <label className="custom-tool-field">
              tool name
              <input value={customToolName} onChange={(event) => setCustomToolName(event.target.value)} maxLength={48} placeholder="e.g. Otter, AssemblyAI, or my own model" />
            </label>
          )}

          <div className="clarity-prompt-section note-panel">
            <div className="clarity-prompt-head">
              <div>
                <p className="clarity-step">02 · read this aloud</p>
                <h2>precision prompt</h2>
              </div>
              <div className="prompt-facts"><span>{wordCount} words</span><span>{punctuationCount} marks</span></div>
            </div>
            <blockquote className="clarity-prompt-text">{prompt.join(' ') || 'choose a prompt style above to begin.'}</blockquote>
            <div className="prompt-signal-row">
              <span>names &amp; tech terms</span>
              <span>numbers &amp; symbols</span>
              <span>punctuation &amp; pauses</span>
            </div>
          </div>

          <div className="clarity-transcript-section">
            <div className="clarity-transcript-head">
              <div>
                <p className="clarity-step">03 · paste the result</p>
                <h2>{testState === 'running' ? `paste ${selectedTool.name}'s transcript` : 'ready when you are'}</h2>
              </div>
              <span className={testState === 'running' ? 'run-status is-live' : 'run-status'}>
                {testState === 'running' ? 'listening for paste' : 'awaiting start'}
              </span>
            </div>
            <textarea
              id="clarity-transcript-input"
              className="clarity-input clarity-transcript-input"
              rows={4}
              placeholder="paste the transcript from your speech-to-text tool…"
              value={transcript}
              onChange={(event) => onChange(event.target.value)}
              readOnly={testState === 'idle'}
              aria-label="Transcription input"
            />
            <div className="clarity-actions">
              {testState === 'idle' ? (
                <button
                  id="btn-clarity-start"
                  onClick={startTool}
                  className="hero-start-btn clarity-start-button"
                  disabled={tool === 'custom' && !customToolName.trim()}
                >
                  start benchmark
                </button>
              ) : (
                <button
                  id="btn-clarity-stop"
                  onClick={onStop}
                  className="desk-btn desk-btn-quiet clarity-score-button"
                  disabled={!transcript.trim()}
                >
                  score transcript <span>→</span>
                </button>
              )}
              <p>{testState === 'idle' ? 'mic stays with your tool — we only score the paste.' : 'paste or type the output, then score it against the prompt.'}</p>
            </div>
          </div>
        </div>

        <aside className="clarity-leaderboard paper-panel" aria-label="Current benchmark leaderboard">
          <span className="hero-paper-tape hero-paper-tape--blue" aria-hidden>board</span>
          <div className="leaderboard-card-head">
            <div>
              <p className="clarity-step">clarity leaders</p>
              <h2>top tools</h2>
            </div>
            <span className="leaderboard-period">last 30 days</span>
          </div>
          <p className="leaderboard-caption">rolling average from verified benchmark pastes.</p>
          <ol>
            {leadersLoading ? (
              <li className="leaderboard-empty">loading verified runs…</li>
            ) : leadersError ? (
              <li className="leaderboard-empty">{leadersError}</li>
            ) : leaders.length === 0 ? (
              <li className="leaderboard-empty">no verified runs yet — be the first to set a pace.</li>
            ) : (
              leaders.slice(0, 5).map((leader, index) => (
                <li key={leader.toolId} className={index === 0 ? 'leader-row is-first' : 'leader-row'}>
                  <span className="leader-rank">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{leader.toolName}</strong>
                    <small>punctuation {leader.punctuationScore}% · {leader.runCount} runs</small>
                  </div>
                  <b>{leader.clarityScore}<small>%</small></b>
                </li>
              ))
            )}
          </ol>
          <div className="leaderboard-foot">
            <span>scored on word fidelity and punctuation.</span>
            <span className="leaderboard-line" />
          </div>
        </aside>
      </div>
    </section>
  )
}
