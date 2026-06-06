'use client'

import type { DiffWord } from '@/store/testStore'

interface ClarityInputProps {
  testState: 'idle' | 'running' | 'ended'
  transcript: string
  diffResult: DiffWord[]
  prompt: string[]
  onChange: (val: string) => void
  onStop: () => void
  onStart: () => void
}

const TAG_CLASS: Record<DiffWord['tag'], string> = {
  correct:     'diff-correct',
  substituted: 'diff-substituted',
  missed:      'diff-missed',
  added:       'diff-added',
}

export default function ClarityInput({
  testState,
  transcript,
  diffResult,
  prompt,
  onChange,
  onStop,
  onStart,
}: ClarityInputProps) {
  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto">
      <p
        className="font-display text-sm font-bold uppercase tracking-widest text-center"
        style={{ color: 'var(--text-stats)' }}
      >
        Speak this prompt using your voice tool
      </p>

      <div className="brutal-card w-full p-5 text-left" aria-label="Prompt text">
        <p
          style={{
            fontSize: 'var(--test-font-size)',
            lineHeight: 'var(--test-line-height)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {prompt.join(' ') || (
            <span style={{ color: 'var(--text-muted)' }}>no prompt — select a type above</span>
          )}
        </p>
      </div>

      {testState !== 'ended' ? (
        <textarea
          id="clarity-transcript-input"
          className="clarity-input w-full"
          rows={5}
          placeholder="activate your voice tool and speak the prompt…"
          value={transcript}
          onChange={(e) => onChange(e.target.value)}
          readOnly={testState === 'idle'}
          aria-label="Transcription input"
        />
      ) : (
        <div
          className="brutal-card w-full p-5 text-left"
          style={{
            fontSize: 'var(--test-font-size)',
            lineHeight: 'var(--test-line-height)',
            minHeight: '8rem',
          }}
          aria-label="Diff result"
        >
          {diffResult.map((w, i) => (
            <span
              key={i}
              className={`inline-block mr-[0.4em] ${TAG_CLASS[w.tag]}`}
              title={w.tag === 'substituted' ? `expected: ${w.expected}` : w.tag}
            >
              {w.word}
            </span>
          ))}
        </div>
      )}

      <div className="flex w-full items-center justify-center gap-4 pt-1">
        {testState === 'idle' && (
          <button
            id="btn-clarity-start"
            onClick={onStart}
            className="brutal-btn brutal-btn-filled"
            aria-label="Start clarity test"
          >
            Start
          </button>
        )}
        {testState === 'running' && (
          <button
            id="btn-clarity-stop"
            onClick={onStop}
            className="brutal-btn brutal-btn-outline"
            style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
            aria-label="Stop clarity test"
          >
            Stop
          </button>
        )}
      </div>
    </div>
  )
}
