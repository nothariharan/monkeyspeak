'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
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
  const [diffVisible, setDiffVisible] = useState(false)

  // When testState flips to 'ended', trigger stagger reveal
  if (testState === 'ended' && !diffVisible) {
    setDiffVisible(true)
  }
  if (testState !== 'ended' && diffVisible) {
    setDiffVisible(false)
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-2xl">
      {/* Prompt display */}
      <div
        className="text-sm leading-relaxed"
        style={{ color: 'var(--text-stats)' }}
        aria-label="Prompt to read"
      >
        speak this prompt using your voice tool:
      </div>

      <div
        className="p-4 rounded leading-loose"
        style={{ border: '1px solid var(--text-muted)', fontSize: 'var(--test-font-size)', lineHeight: 'var(--test-line-height)' }}
        aria-label="Prompt text"
      >
        {prompt.join(' ') || <span style={{ color: 'var(--text-muted)' }}>no prompt — select a type above</span>}
      </div>

      {/* Input / diff area */}
      {testState !== 'ended' ? (
        <textarea
          id="clarity-transcript-input"
          className="clarity-input"
          rows={5}
          placeholder="activate your voice tool and speak the prompt…"
          value={transcript}
          onChange={(e) => onChange(e.target.value)}
          readOnly={testState === 'idle'}
          aria-label="Transcription input"
        />
      ) : (
        /* Staggered diff reveal */
        <div
          className="p-4 rounded leading-loose"
          style={{
            border: '1px solid var(--text-muted)',
            fontSize: 'var(--test-font-size)',
            lineHeight: 'var(--test-line-height)',
            minHeight: '8rem',
          }}
          aria-label="Diff result"
        >
          {diffResult.map((w, i) => (
            <motion.span
              key={i}
              className={`inline-block mr-[0.4em] ${TAG_CLASS[w.tag]}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03, duration: 0.15 }}
              title={w.tag === 'substituted' ? `expected: ${w.expected}` : w.tag}
            >
              {w.word}
            </motion.span>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        {testState === 'idle' && (
          <button
            id="btn-clarity-start"
            onClick={onStart}
            className="pill-btn active px-5 py-2 text-base"
            aria-label="Start clarity test"
          >
            start
          </button>
        )}
        {testState === 'running' && (
          <button
            id="btn-clarity-stop"
            onClick={onStop}
            className="pill-btn px-5 py-2 text-base"
            style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
            aria-label="Stop clarity test"
          >
            stop
          </button>
        )}
      </div>
    </div>
  )
}
