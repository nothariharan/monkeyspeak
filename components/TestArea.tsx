'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import type { WordResult } from '@/store/testStore'
import {
  useSpeculativeMatch,
  MAX_SPECULATIVE_LOOKAHEAD,
  type PromptWordState,
  type WordStatus,
} from '@/hooks/useSpeculativeMatch'

interface TestAreaProps {
  words: string[]
  confirmedWords: WordResult[]
  currentWordIndex: number
  liveTranscript: string
  isIdle?: boolean
  /** When true, show a rolling window (~4 lines) instead of the full prompt */
  testActive?: boolean
}

/** ~2 lines of monospace prompt at typical widths; wraps naturally inside max-height window */
const WINDOW_WORDS = 64
const PREFIX_BEFORE_CURRENT = 4
const ACTIVE_VISIBLE_LINES = 2

function getWindowRange(wordCount: number, currentWordIndex: number) {
  if (wordCount === 0) return { start: 0, end: 0 }
  let start = Math.max(0, currentWordIndex - PREFIX_BEFORE_CURRENT)
  if (start + WINDOW_WORDS > wordCount) {
    start = Math.max(0, wordCount - WINDOW_WORDS)
  }
  const end = Math.min(wordCount, start + WINDOW_WORDS)
  return { start, end }
}

// 80ms: prevents flicker on rapid hypothesis revisions while keeping worst-case
// latency at ~130ms (50ms debounce + 80ms hysteresis). Previous 200ms stacked on
// the old 150ms debounce for a 350ms worst-case that felt visibly laggy.
const STATUS_HYSTERESIS_MS = 0

const STATUS_STYLES: Record<WordStatus, CSSProperties> = {
  correct: {
    color: '#7eb8f7',
    fontWeight: 600,
  },
  speculative: {
    color: '#7eb8f7',
    fontWeight: 600,
    opacity: 0.65,
  },
  wrong: {
    color: '#ca4754',
    fontWeight: 400,
  },
  current: {
    color: '#e2e2e2',
    fontWeight: 400,
  },
  pending: {
    color: '#2e2e38',
    fontWeight: 400,
  },
}

function Word({ state, idlePreview }: { state: PromptWordState; idlePreview?: boolean }) {
  const lastStatusRef = useRef<WordStatus>(state.status)
  const lastChangeAtRef = useRef(Date.now())
  const [stableStatus, setStableStatus] = useState<WordStatus>(state.status)

  useEffect(() => {
    if (idlePreview) {
      setStableStatus(state.status)
      lastStatusRef.current = state.status
      lastChangeAtRef.current = Date.now()
      return
    }
    setStableStatus(state.status)
    lastStatusRef.current = state.status
    lastChangeAtRef.current = Date.now()
  }, [state.status, idlePreview])

  const displayStatus = idlePreview ? state.status : stableStatus

  const base = STATUS_STYLES[displayStatus]
  const style: CSSProperties =
    idlePreview && (state.status === 'pending' || state.status === 'current')
      ? {
          ...base,
          color: state.status === 'current' ? 'var(--accent)' : 'var(--text-muted)',
          opacity: 1,
        }
      : base

  return (
    <span
      style={{
        display: 'inline-block',
        marginRight: '0.45em',
        position: 'relative',
        transition: 'color 0.08s ease, opacity 0.08s ease',
        ...style,
      }}
    >
      {state.word}

      {displayStatus === 'current' && !idlePreview && (
        <motion.span
          style={{
            position: 'absolute',
            bottom: 2,
            left: 0,
            right: 0,
            height: 2,
            background: '#7eb8f7',
            borderRadius: 1,
          }}
          aria-hidden
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </span>
  )
}

export default function TestArea({
  words,
  confirmedWords,
  currentWordIndex,
  liveTranscript,
  isIdle = false,
  testActive = false,
}: TestAreaProps) {
  const confirmedStrings = useMemo(
    () => confirmedWords.map((c) => c.word),
    [confirmedWords]
  )

  const interimForSpec = testActive && !isIdle ? liveTranscript : ''

  const wordStates = useSpeculativeMatch({
    promptWords: words,
    confirmedWords: confirmedStrings,
    interimText: interimForSpec,
  })

  const hasActiveInterim = interimForSpec.trim().length > 0
  const speculativeCount = hasActiveInterim
    ? wordStates
        .slice(currentWordIndex, currentWordIndex + MAX_SPECULATIVE_LOOKAHEAD)
        .filter((ws) => ws.status === 'speculative' || ws.status === 'correct')
        .length
    : 0
  const windowAnchor = hasActiveInterim
    ? Math.min(currentWordIndex + speculativeCount, Math.max(0, words.length - 1))
    : currentWordIndex

  const { start: windowStart, end: windowEnd } = useMemo(
    () => getWindowRange(words.length, windowAnchor),
    [words.length, windowAnchor]
  )

  const visibleStates = useMemo(() => {
    if (testActive && !isIdle) {
      return wordStates.slice(windowStart, windowEnd).map((ws, localI) => ({
        ws,
        globalIndex: windowStart + localI,
      }))
    }
    return wordStates.map((ws, globalIndex) => ({ ws, globalIndex }))
  }, [wordStates, testActive, isIdle, windowStart, windowEnd])

  /** Must match line box used for height — same vars as globals `.word` / settings. */
  const activeRunStyles: CSSProperties | undefined =
    testActive && !isIdle
      ? {
          fontFamily: 'var(--font-mono), ui-monospace, monospace',
          fontSize: 'var(--test-font-size)',
          lineHeight: 'var(--test-line-height)',
        }
      : undefined

  return (
    <div className="flex flex-col gap-4 items-center w-full">
      <div
        className={`select-none transition-all duration-300 w-full ${
          isIdle
            ? 'leading-relaxed line-clamp-2 text-ellipsis overflow-hidden max-h-[3.5em] opacity-40 text-center'
            : testActive
              ? 'text-left overflow-x-hidden'
              : 'text-left leading-relaxed'
        }`}
        style={{
          maxWidth: '100%',
          ...(testActive && !isIdle
            ? {
                /* Keep the active window to exactly two text lines. */
                maxHeight: `calc(${ACTIVE_VISIBLE_LINES} * var(--test-line-height))`,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                paddingBottom: 4,
                ...activeRunStyles,
              }
            : {}),
        }}
        aria-label="Speaking prompt"
        aria-live="polite"
      >
        {visibleStates.map(({ ws, globalIndex }) => (
          <Word key={`${globalIndex}-${ws.word}`} state={ws} idlePreview={isIdle} />
        ))}
      </div>
    </div>
  )
}
