'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useTestStore } from '@/store/testStore'
import type { WordResult } from '@/store/testStore'

interface TestAreaProps {
  words: string[]
  confirmedWords: WordResult[]
  currentWordIndex: number
  liveTranscript: string
  isIdle?: boolean
  /** When true, show a MonkeyType-style ~2-line rolling window instead of the full prompt */
  testActive?: boolean
}

const WINDOW_WORDS = 34
const PREFIX_BEFORE_CURRENT = 9

function getWindowRange(wordCount: number, currentWordIndex: number) {
  if (wordCount === 0) return { start: 0, end: 0 }
  let start = Math.max(0, currentWordIndex - PREFIX_BEFORE_CURRENT)
  if (start + WINDOW_WORDS > wordCount) {
    start = Math.max(0, wordCount - WINDOW_WORDS)
  }
  const end = Math.min(wordCount, start + WINDOW_WORDS)
  return { start, end }
}

export default function TestArea({
  words,
  confirmedWords,
  currentWordIndex,
  liveTranscript,
  isIdle = false,
  testActive = false,
}: TestAreaProps) {
  const { settings } = useTestStore()

  const { start: windowStart, end: windowEnd } = useMemo(
    () => getWindowRange(words.length, currentWordIndex),
    [words.length, currentWordIndex]
  )

  const getWordState = (globalIndex: number): 'unspoken' | 'correct' | 'error' | 'current' => {
    if (globalIndex < currentWordIndex) {
      const w = confirmedWords[globalIndex]
      if (!w) return 'unspoken'
      return w.isCorrect ? 'correct' : 'error'
    }
    if (globalIndex === currentWordIndex) return 'current'
    return 'unspoken'
  }

  return (
    <div className="flex flex-col gap-4 items-center w-full">
      {/* Prompt word display */}
      <div
        className={`leading-relaxed select-none transition-all duration-300 w-full ${
          isIdle
            ? 'line-clamp-2 text-ellipsis overflow-hidden max-h-[3.5em] opacity-40 text-center'
            : testActive
              ? 'text-left overflow-hidden'
              : 'text-left'
        }`}
        style={
          testActive
            ? {
                maxWidth: '48rem',
                maxHeight: 'calc(2 * var(--test-line-height))',
              }
            : { maxWidth: '48rem' }
        }
        aria-label="Speaking prompt"
        aria-live="polite"
      >
        {(testActive && !isIdle ? words.slice(windowStart, windowEnd) : words).map((word, localI) => {
          const i = testActive && !isIdle ? windowStart + localI : localI
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
              {testActive &&
              !isIdle &&
              settings.showLiveTranscript &&
              state === 'current' &&
              liveTranscript ? (
                <span className="ghost-interim-inline" aria-hidden>
                  {' '}
                  {liveTranscript}
                </span>
              ) : null}
            </motion.span>
          )
        })}
      </div>

      {/* Live interim is inline after the current word (caret-adjacent); keep polite region on prompt */}
      {testActive && !isIdle && settings.showLiveTranscript && liveTranscript ? (
        <span className="sr-only" aria-live="polite">
          {liveTranscript}
        </span>
      ) : null}
    </div>
  )
}
