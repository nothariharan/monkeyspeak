'use client'

import { motion } from 'framer-motion'
import { useTestStore } from '@/store/testStore'
import type { WordResult } from '@/store/testStore'

interface TestAreaProps {
  words: string[]
  confirmedWords: WordResult[]
  currentWordIndex: number
  liveTranscript: string
}

export default function TestArea({
  words,
  confirmedWords,
  currentWordIndex,
  liveTranscript,
}: TestAreaProps) {
  const { settings } = useTestStore()

  const getWordState = (index: number): 'unspoken' | 'correct' | 'error' | 'current' => {
    if (index < currentWordIndex) {
      const w = confirmedWords[index]
      if (!w) return 'unspoken'
      return w.isCorrect ? 'correct' : 'error'
    }
    if (index === currentWordIndex) return 'current'
    return 'unspoken'
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Prompt word display */}
      <div
        className="leading-relaxed select-none"
        style={{ maxWidth: '48rem' }}
        aria-label="Speaking prompt"
        aria-live="polite"
      >
        {words.map((word, i) => {
          const state = getWordState(i)
          return (
            <motion.span
              key={`${word}-${i}`}
              className={`word ${state}`}
              animate={
                state === 'correct'
                  ? { scale: [1, 1.02, 1] }
                  : state === 'error'
                  ? { x: [0, -2, 2, -1, 1, 0] }
                  : {}
              }
              transition={
                state === 'correct'
                  ? { duration: 0.15, ease: 'easeOut' }
                  : state === 'error'
                  ? { duration: 0.2 }
                  : {}
              }
            >
              {word}
            </motion.span>
          )
        })}
      </div>

      {/* Live transcript ghost text */}
      {settings.showLiveTranscript && (
        <div className="ghost-transcript" aria-label="Live transcription" aria-live="polite">
          {liveTranscript || <span className="opacity-0">‌</span>}
        </div>
      )}
    </div>
  )
}
