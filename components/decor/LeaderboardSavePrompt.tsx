'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_LEADERBOARD_EMOJI,
  LEADERBOARD_EMOJI_OPTIONS,
} from '@/lib/stats/leaderboard'
import { submitLeaderboardScore } from '@/lib/leaderboard/client'
import { useTestStore, type Duration, type PromptType } from '@/store/testStore'

interface PendingLeaderboardScore {
  wpm: number
  accuracy: number
  duration: Duration
  promptType: PromptType
  elapsedSec: number
  runToken: string
}

interface LeaderboardSavePromptProps {
  score: PendingLeaderboardScore | null
  onClose: () => void
  onSaved?: () => void
}

function cleanName(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export default function LeaderboardSavePrompt({ score, onClose, onSaved }: LeaderboardSavePromptProps) {
  const savedName = useTestStore((s) => s.settings.leaderboardName)
  const savedEmoji = useTestStore((s) => s.settings.leaderboardEmoji)
  const setLeaderboardName = useTestStore((s) => s.setLeaderboardName)
  const setLeaderboardEmoji = useTestStore((s) => s.setLeaderboardEmoji)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(savedName ?? '')
  const [emoji, setEmoji] = useState(savedEmoji ?? DEFAULT_LEADERBOARD_EMOJI)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!score) return
    setName(savedName ?? '')
    setEmoji(savedEmoji ?? DEFAULT_LEADERBOARD_EMOJI)
    setEditing(!savedName)
    setError('')
  }, [score, savedName, savedEmoji])

  const title = useMemo(() => {
    if (!score) return ''
    if (savedName && !editing) return `save ${score.wpm} wpm as ${savedName}?`
    return 'save this run?'
  }, [score, savedName, editing])

  if (!score) return null

  const save = async () => {
    const nextName = cleanName(name)
    if (nextName.length < 2 || nextName.length > 18) {
      setError('name needs 2 to 18 characters')
      return
    }

    setSaving(true)
    setError('')

    try {
      await submitLeaderboardScore({
        name: nextName,
        emoji,
        wpm: score.wpm,
        accuracy: score.accuracy,
        duration: score.duration,
        promptType: score.promptType,
        elapsedSec: score.elapsedSec,
        runToken: score.runToken,
      })
      setLeaderboardName(nextName)
      setLeaderboardEmoji(emoji)
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'could not save score')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="leaderboard-save-backdrop" role="presentation">
      <section className="leaderboard-save-card paper-panel" role="dialog" aria-modal="true" aria-label="Save score to leaderboard">
        <span className="hero-paper-tape hero-paper-tape--blue" aria-hidden />
        <div className="leaderboard-save-score">
          <span className="stat-label">{score.duration}s run</span>
          <strong>{score.wpm}</strong>
          <span>wpm</span>
        </div>

        <div className="leaderboard-save-copy">
          <h2>{title}</h2>
          <p>pick a name and icon for the board.</p>
        </div>

        {(editing || !savedName) && (
          <>
            <label className="leaderboard-name-field">
              <span>name</span>
              <input
                value={name}
                maxLength={18}
                onChange={(event) => {
                  setName(event.target.value)
                  setError('')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    event.stopPropagation()
                    void save()
                  }
                }}
                autoFocus
                placeholder="speedysam"
              />
            </label>

            <div className="leaderboard-emoji-field">
              <span>icon</span>
              <div className="leaderboard-emoji-picker" role="listbox" aria-label="Choose leaderboard icon">
                {LEADERBOARD_EMOJI_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={emoji === option}
                    className={`leaderboard-emoji-option${emoji === option ? ' active' : ''}`}
                    onClick={() => setEmoji(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {error && <p className="leaderboard-save-error">{error}</p>}

        <div className="leaderboard-save-actions">
          <button type="button" className="desk-btn desk-btn-primary" onClick={() => void save()} disabled={saving}>
            {saving ? 'saving...' : 'save score'}
          </button>
          {savedName && !editing && (
            <button type="button" className="desk-btn desk-btn-quiet" onClick={() => setEditing(true)}>
              edit name
            </button>
          )}
          <button type="button" className="leaderboard-skip-btn" onClick={onClose} disabled={saving}>
            skip
          </button>
        </div>
      </section>
    </div>
  )
}
