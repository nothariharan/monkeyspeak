'use client'

import { useState } from 'react'
import { useClarityLeaderboard } from '@/hooks/useClarityLeaderboard'
import { clarityToolIcon } from '@/lib/clarityLeaderboard/tools'
import { MEDAL_LABEL } from '@/components/leaderboard/leaderboardUtils'

const BOARD_LIMIT = 50

type ClarityBoardPrompt = 'all' | 'sentences' | 'technical' | 'tongue-twisters' | 'custom'

const CLARITY_BOARD_PROMPTS: { label: string; value: ClarityBoardPrompt }[] = [
  { label: 'all prompts', value: 'all' },
  { label: 'sentences', value: 'sentences' },
  { label: 'technical', value: 'technical' },
  { label: 'tongue twisters', value: 'tongue-twisters' },
  { label: 'custom', value: 'custom' },
]

function promptLabel(value: ClarityBoardPrompt): string {
  return CLARITY_BOARD_PROMPTS.find((p) => p.value === value)?.label ?? value
}

export default function ClarityLeaderboardSection() {
  const [promptType, setPromptType] = useState<ClarityBoardPrompt>('all')
  const { rows, loading, error } = useClarityLeaderboard({
    promptType: promptType === 'all' ? undefined : promptType,
    limit: BOARD_LIMIT,
  })

  const toolCount = rows.length

  return (
    <section className="hero-widget leaderboard-section" aria-label="Speech-to-text tool leaderboard">
      <div className="hero-widget-head">
        <span className="hero-widget-icon" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.955.734H5.808a1 1 0 0 1-.957-.734L2.018 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
            <path d="M5 21h14" />
          </svg>
        </span>
        <div className="hero-widget-copy">
          <h2>top tools</h2>
          <p>{promptLabel(promptType)} · last 30 days</p>
        </div>
      </div>

      <div className="leaderboard-filters">
        <div className="leaderboard-prompt-tabs" role="tablist" aria-label="Clarity board prompt type">
          {CLARITY_BOARD_PROMPTS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={promptType === opt.value}
              className={promptType === opt.value ? 'active' : ''}
              onClick={() => setPromptType(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="leaderboard-full-list" tabIndex={0} aria-label="Speech-to-text tool rankings">
        {loading ? (
          <p className="hero-leaderboard-empty font-mono">loading verified runs...</p>
        ) : error ? (
          <p className="hero-leaderboard-empty font-mono">{error}</p>
        ) : rows.length === 0 ? (
          <p className="hero-leaderboard-empty font-mono">no verified runs yet — benchmark your tool to put it on the board</p>
        ) : (
          rows.map((row, index) => {
            const medal = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : undefined
            const icon = clarityToolIcon(row.toolId)
            return (
              <div key={row.toolId} className="leaderboard-full-row hero-leaderboard-row">
                <span className={`hero-rank hero-rank--${medal ?? 'plain'}`}>
                  {medal ? MEDAL_LABEL[medal] : index + 1}
                </span>
                <span className="hero-player-emoji" aria-hidden>
                  {icon ? <img src={icon} alt="" className="clarity-board-toolicon" /> : '🎙️'}
                </span>
                <div className="hero-player-copy">
                  <strong>{row.toolName}</strong>
                  <span>punctuation {row.punctuationScore}% · {row.runCount} run{row.runCount === 1 ? '' : 's'}</span>
                </div>
                <span className="hero-player-score tabular-nums">{row.clarityScore}%</span>
              </div>
            )
          })
        )}
      </div>

      {!loading && !error && (
        <p className="leaderboard-board-count font-mono">
          {toolCount === 0
            ? 'no tools on this board yet'
            : `${toolCount} tool${toolCount === 1 ? '' : 's'} on this board · rolling 30-day average clarity`}
        </p>
      )}
    </section>
  )
}
