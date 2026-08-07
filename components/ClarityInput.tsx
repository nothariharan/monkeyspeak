'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { DiffWord } from '@/store/testStore'
import { useTestStore } from '@/store/testStore'
import { useClarityLeaderboard } from '@/hooks/useClarityLeaderboard'
import { CLARITY_TOOLS, clarityToolIcon } from '@/lib/clarityLeaderboard/tools'
import { getClarityPromptMeta, type ClaritySignal } from '@/lib/clarityPrompts'

interface ClarityInputProps {
  testState: 'idle' | 'running' | 'ended'
  transcript: string
  diffResult: DiffWord[]
  prompt: string[]
  onChange: (val: string) => void
  onStop: () => void
  onCancel: () => void
  onStart: (tool: { id: string; name: string }) => void
  onShuffle: () => void
}

const TOOLS = CLARITY_TOOLS

const SIGNAL_LABELS: { id: ClaritySignal; label: string }[] = [
  { id: 'names', label: 'names & terms' },
  { id: 'numbers', label: 'numbers & symbols' },
  { id: 'punctuation', label: 'punctuation' },
  { id: 'pauses', label: 'pauses' },
]

const CLARITY_TIPS = [
  'pick one engine and stick with it for the run',
  'read the pad once before you hit start',
  'say numbers, names, and quotes exactly as written',
  'paste the full transcript — don’t edit it first',
]

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="2" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 18v3M9 21h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ShuffleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M21 3v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckMark() {
  return (
    <svg className="clarity-check-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.14" />
      <path d="M7.5 12.5 10.5 15.5 16.5 9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CrownDoodle() {
  return (
    <svg className="clarity-crown-doodle" width="36" height="25" viewBox="0 0 52 36" fill="none" aria-hidden>
      <path d="M6 28 L10 12 L20 22 L26 8 L32 22 L42 12 L46 28 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 28 H44" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="26" cy="6" r="1.5" fill="currentColor" />
    </svg>
  )
}

function StarDoodle() {
  return (
    <svg className="clarity-star-doodle" width="20" height="20" viewBox="0 0 28 28" fill="none" aria-hidden>
      <path
        d="M14 3 L16.2 10.2 L24 11 L18 15.8 L19.8 24 L14 19.8 L8.2 24 L10 15.8 L4 11 L11.8 10.2 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function ClarityInput({
  testState,
  transcript,
  prompt,
  onChange,
  onStop,
  onCancel,
  onStart,
  onShuffle,
}: ClarityInputProps) {
  const [tool, setTool] = useState(TOOLS[0].id)
  const [customToolName, setCustomToolName] = useState('')
  const promptType = useTestStore((s) => s.promptType)
  const boardPromptType =
    promptType === 'sentences' ||
    promptType === 'technical' ||
    promptType === 'tongue-twisters' ||
    promptType === 'custom'
      ? promptType
      : undefined
  const { rows: leaders, loading: leadersLoading, error: leadersError } = useClarityLeaderboard({
    promptType: boardPromptType,
    limit: 5,
  })
  const sessionHistory = useTestStore((s) => s.settings.sessionHistory)

  const selectedTool = useMemo(
    () =>
      tool === 'custom'
        ? { id: 'custom', name: customToolName.trim() || 'Custom Engine', icon: null }
        : TOOLS.find((item) => item.id === tool) ?? TOOLS[0],
    [tool, customToolName]
  )

  const promptText = prompt.join(' ')
  const wordCount = prompt.length
  const punctuationCount = promptText.match(/[,.!?;:—'"]/g)?.length ?? 0
  const promptMeta = useMemo(() => getClarityPromptMeta(promptText), [promptText])
  const activeSignals = useMemo(
    () => new Set<ClaritySignal>(promptMeta?.signals ?? ['names', 'numbers', 'punctuation', 'pauses']),
    [promptMeta]
  )

  const clarityRuns = useMemo(
    () => sessionHistory.filter((entry) => entry.mode === 'clarity'),
    [sessionHistory]
  )

  const currentClarity = clarityRuns[0] ?? null
  const bestClarity = useMemo(() => {
    if (clarityRuns.length === 0) return null
    return clarityRuns.reduce((best, entry) => (entry.accuracy > best.accuracy ? entry : best))
  }, [clarityRuns])

  const boardPromptLabel =
    boardPromptType === 'tongue-twisters'
      ? 'tongue twisters'
      : boardPromptType ?? 'all prompts'

  const startTool = () => {
    const id =
      selectedTool.id === 'custom'
        ? `custom-${selectedTool.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'tool'}`
        : selectedTool.id
    onStart({ id, name: selectedTool.name })
  }

  return (
    <section className="clarity-benchmark hero-shell" aria-label="Speech-to-text clarity benchmark">
      <div className="clarity-stage hero-stage">
        <aside className="clarity-board paper-panel hero-animate" aria-label="Engine leaderboard">
          <span className="hero-paper-tape hero-paper-tape--blue" aria-hidden />
          <div className="clarity-board-head">
            <div>
              <p className="clarity-step">engine board</p>
              <h2>leaderboard</h2>
            </div>
            <span className="leaderboard-period" title="filtered by prompt type in the bar above">
              {boardPromptLabel}
            </span>
          </div>
          <ol>
            {leadersLoading ? (
              <li className="leaderboard-empty">loading verified runs…</li>
            ) : leadersError ? (
              <li className="leaderboard-empty">{leadersError}</li>
            ) : leaders.length === 0 ? (
              <li className="leaderboard-empty leaderboard-empty--soft">
                <div className="leaderboard-empty-top">
                  <span className="leaderboard-empty-mark" aria-hidden>
                    ✦
                  </span>
                  <strong>board is open</strong>
                </div>
                <p>
                  no verified {boardPromptLabel} runs yet. finish a clarity test to plant the first
                  score.
                </p>
              </li>
            ) : (
              leaders.slice(0, 5).map((leader, index) => {
                const icon = clarityToolIcon(leader.toolId)
                return (
                  <li key={leader.toolId} className={index === 0 ? 'leader-row is-first' : 'leader-row'}>
                    <span className="leader-rank">{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <strong>{leader.toolName}</strong>
                      <small>
                        punct {leader.punctuationScore}% · {leader.runCount} runs
                      </small>
                    </div>
                    <b className="leader-score">
                      {icon ? (
                        <img src={icon} alt="" className="clarity-board-toolicon" />
                      ) : (
                        <span className="clarity-board-toolicon clarity-board-toolicon--fallback" aria-hidden>
                          🎙️
                        </span>
                      )}
                      <span>
                        {leader.clarityScore}
                        <small>%</small>
                      </span>
                    </b>
                  </li>
                )
              })
            )}
          </ol>
          <div className="clarity-board-foot">
            <Link href="/leaderboard" className="clarity-score-link">
              how is this scored?
            </Link>
            <div className="clarity-board-doodle" aria-hidden>
              <CrownDoodle />
              <StarDoodle />
              <p>different engines, different strengths!</p>
            </div>
          </div>
        </aside>

        <section className="clarity-center" aria-label="Clarity check">
          <header className="clarity-intro hero-animate">
            <div className="clarity-intro-copy">
              <p className="clarity-eyebrow">clarity check</p>
              <h1>
                how clear can it <span className="clarity-hear">hear?</span>
              </h1>
              <p className="clarity-lede">
                test any speech engine. read it aloud and see how well it understood.
              </p>
              <div className="clarity-privacy-note">
                <Image
                  src="/clarity-privacy-monkey.png"
                  alt=""
                  width={28}
                  height={28}
                  className="clarity-privacy-icon"
                />
                <span>your mic stays with the tool. monkeyspeak only scores the paste.</span>
              </div>
            </div>
            <div className="clarity-mascot-wrap" aria-hidden="true">
              <Image
                src="/clarity-current-1.png"
                alt=""
                width={220}
                height={234}
                priority
                className="clarity-mascot"
              />
              <span className="clarity-scribble">
                let&apos;s inspect
                <br />
                your clarity!
              </span>
            </div>
          </header>

          <div className="clarity-main-card paper-panel hero-animate">
            <div className="clarity-card-header">
              <div>
                <p className="clarity-step">01 · pick an engine</p>
                <h2>which engine are you testing?</h2>
              </div>
            </div>

            <div className="tool-roster" aria-label="Available benchmark tools">
              {TOOLS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={tool === item.id ? 'tool-choice is-active' : 'tool-choice'}
                  onClick={() => setTool(item.id)}
                  disabled={testState !== 'idle'}
                  aria-pressed={tool === item.id}
                >
                  {tool === item.id && (
                    <span className="tool-choice-check" aria-hidden>
                      <CheckMark />
                    </span>
                  )}
                  {item.icon ? (
                    <img src={item.icon} alt="" className="tool-logo" />
                  ) : (
                    <span className="chatgpt-voice-icon" aria-hidden />
                  )}
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.blurb}</small>
                  </span>
                </button>
              ))}
              <button
                type="button"
                className={tool === 'custom' ? 'tool-choice is-active' : 'tool-choice'}
                onClick={() => setTool('custom')}
                disabled={testState !== 'idle'}
                aria-pressed={tool === 'custom'}
              >
                {tool === 'custom' && (
                  <span className="tool-choice-check" aria-hidden>
                    <CheckMark />
                  </span>
                )}
                <span className="tool-add-icon">+</span>
                <span>
                  <strong>Custom Engine</strong>
                  <small>enter api / url</small>
                </span>
              </button>
            </div>

            {tool === 'custom' && (
              <label className="custom-tool-field">
                tool name
                <input
                  value={customToolName}
                  onChange={(event) => setCustomToolName(event.target.value)}
                  maxLength={48}
                  placeholder="e.g. Otter, AssemblyAI, or my own model"
                  disabled={testState !== 'idle'}
                />
              </label>
            )}

            <div className="clarity-prompt-section">
              <div className="clarity-prompt-head">
                <div>
                  <p className="clarity-step">02 · read this out loud</p>
                  <h2>precision prompt</h2>
                </div>
                <div className="prompt-facts">
                  {promptMeta ? <span className="prompt-scene">{promptMeta.scene}</span> : null}
                  <span>{wordCount} words</span>
                  <span>{punctuationCount} marks</span>
                </div>
              </div>

              <div className="clarity-legal-pad">
                <span className="clarity-paperclip" aria-hidden />
                <blockquote className="clarity-prompt-text">
                  {promptText || 'choose a prompt style above to begin.'}
                </blockquote>
              </div>

              <div className="prompt-signal-row">
                {SIGNAL_LABELS.map(({ id, label }) => {
                  const active = activeSignals.has(id)
                  return (
                    <span
                      key={id}
                      className={active ? 'prompt-signal is-active' : 'prompt-signal is-muted'}
                      aria-current={active ? 'true' : undefined}
                    >
                      {active ? <CheckMark /> : <span className="prompt-signal-dot" aria-hidden />}
                      {label}
                    </span>
                  )
                })}
              </div>

              <div className="clarity-prompt-actions">
                <button
                  type="button"
                  className="clarity-shuffle-btn"
                  onClick={onShuffle}
                  disabled={testState !== 'idle'}
                >
                  <ShuffleIcon />
                  shuffle prompt
                </button>
              </div>
            </div>

            {testState === 'running' && (
              <div className="clarity-transcript-section">
                <div className="clarity-transcript-head">
                  <div>
                    <p className="clarity-step">03 · paste the result</p>
                    <h2>paste {selectedTool.name}&apos;s transcript</h2>
                  </div>
                  <span className="run-status is-live">listening for paste</span>
                </div>
                <textarea
                  id="clarity-transcript-input"
                  className="clarity-input clarity-transcript-input"
                  rows={4}
                  placeholder="paste the transcript from your speech-to-text tool…"
                  value={transcript}
                  onChange={(event) => onChange(event.target.value)}
                  aria-label="Transcription input"
                />
              </div>
            )}

            <div className="clarity-cta">
              {testState === 'idle' ? (
                <button
                  id="btn-clarity-start"
                  onClick={startTool}
                  className="hero-start-btn clarity-start-button"
                  disabled={tool === 'custom' && !customToolName.trim()}
                >
                  <MicIcon />
                  start clarity test
                </button>
              ) : (
                <div className="clarity-cta-row">
                  <button
                    type="button"
                    id="btn-clarity-cancel"
                    onClick={onCancel}
                    className="desk-btn desk-btn-quiet clarity-cancel-button"
                  >
                    cancel
                  </button>
                  <button
                    id="btn-clarity-stop"
                    onClick={onStop}
                    className="desk-btn desk-btn-quiet clarity-score-button"
                    disabled={!transcript.trim()}
                  >
                    score transcript <span>→</span>
                  </button>
                </div>
              )}
              <p className="clarity-cta-note">
                {testState === 'idle'
                  ? 'no signup, no account. just a clarity check ❤️'
                  : 'paste or type the output, then score it — or cancel to exit.'}
              </p>
            </div>
          </div>
        </section>

        <div className="hero-side-stack clarity-side-stack hero-animate">
          <div
            className={`clarity-scorecard paper-panel${bestClarity || currentClarity ? '' : ' clarity-scorecard--empty'}`}
            role="status"
            aria-live="polite"
            aria-label={
              bestClarity
                ? `Current clarity ${currentClarity?.accuracy ?? 0} percent. Top clarity ${bestClarity.accuracy} percent${bestClarity.toolName ? ` with ${bestClarity.toolName}` : ''}`
                : 'No clarity scores yet'
            }
          >
            <span className="hero-paper-tape hero-paper-tape--orange" aria-hidden />
            <div className="clarity-scorecard-head">
              <span className="momentum-fire-label">your clarity</span>
              {bestClarity?.toolName ? (
                <span className="clarity-scorecard-tool" title="engine behind your top score">
                  {bestClarity.toolName}
                </span>
              ) : (
                <span className="clarity-scorecard-tool is-empty">no top tool yet</span>
              )}
            </div>
            <div className="clarity-scorecard-metrics">
              <div className="clarity-scorecard-metric">
                <span className="clarity-scorecard-metric-label">current</span>
                <span className="clarity-scorecard-metric-value tabular-nums">
                  {currentClarity ? `${currentClarity.accuracy}` : '—'}
                  {currentClarity ? <small>%</small> : null}
                </span>
              </div>
              <div className="clarity-scorecard-metric clarity-scorecard-metric--top">
                <span className="clarity-scorecard-metric-label">top</span>
                <span className="clarity-scorecard-metric-value tabular-nums">
                  {bestClarity ? `${bestClarity.accuracy}` : '—'}
                  {bestClarity ? <small>%</small> : null}
                </span>
              </div>
            </div>
            <span className="clarity-scorecard-foot">
              {bestClarity
                ? [
                    currentClarity && currentClarity !== bestClarity
                      ? `latest · ${currentClarity.toolName ?? currentClarity.promptType}`
                      : null,
                    `${clarityRuns.length} run${clarityRuns.length === 1 ? '' : 's'} saved`,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : 'finish a test to pin current + top here'}
            </span>
          </div>

          <section className="hero-sticky-note hero-sticky-note--tips" aria-label="Quick tips">
            <span className="hero-paper-tape hero-paper-tape--purple" aria-hidden />
            <div className="hero-sticky-note-head">
              <span className="hero-sticky-note-icon" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18h6" />
                  <path d="M10 22h4" />
                  <path d="M12 2a7 7 0 0 0-4 12v2h8v-2a7 7 0 0 0-4-12z" />
                </svg>
              </span>
              <h3>clarity tips</h3>
            </div>
            <ul className="hero-tips-list">
              {CLARITY_TIPS.map((tip) => (
                <li key={tip}>
                  <span className="hero-tips-check" aria-hidden />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <div className="clarity-floor" aria-hidden>
        <div className="clarity-paste-hint">
          <Image
            src="/clarity-paste-bubble-monkey.png"
            alt=""
            width={48}
            height={48}
            className="clarity-paste-monkey"
          />
          <span className="clarity-paste-bubble">paste your result after you speak!</span>
        </div>
        <p className="clarity-slogan">beat your score. beat the board. beat yourself.</p>
      </div>
    </section>
  )
}
