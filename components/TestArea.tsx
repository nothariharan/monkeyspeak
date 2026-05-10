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
import { emitDebugLog } from '@/lib/debugLog'

interface TestAreaProps {
  words: string[]
  confirmedWords: WordResult[]
  currentWordIndex: number
  liveTranscript: string
  isIdle?: boolean
  /** When true, show a rolling window (~4 lines) instead of the full prompt */
  testActive?: boolean
}

/** Approximate words per line at typical desktop width + large test font */
const WORDS_PER_LINE = 12
/** Lines shown at once (matches max-height / line box) */
const ACTIVE_VISIBLE_LINES = 3
/** Do not reveal the next passage until this many full lines are completed */
const LINES_BEFORE_ADVANCE = 2
/** Max words in the visible slice */
const WINDOW_WORDS = WORDS_PER_LINE * ACTIVE_VISIBLE_LINES

/** Applies only to speculative/wrong transitions in `<Word />` (see below). */
const STATUS_HYSTERESIS_MS = 32

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
    color: 'var(--text-muted)',
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
    const delay =
      state.status === 'speculative' || state.status === 'wrong'
    if (!delay) {
      setStableStatus(state.status)
      lastStatusRef.current = state.status
      lastChangeAtRef.current = Date.now()
      return
    }
    const t = window.setTimeout(() => {
      setStableStatus(state.status)
      lastStatusRef.current = state.status
      lastChangeAtRef.current = Date.now()
    }, STATUS_HYSTERESIS_MS)
    return () => window.clearTimeout(t)
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

  const [chunkStart, setChunkStart] = useState(0)

  useEffect(() => {
    setChunkStart(0)
  }, [words])

  useEffect(() => {
    if (isIdle) setChunkStart(0)
  }, [isIdle])

  useEffect(() => {
    if (!testActive || isIdle) return
    const advanceBy = LINES_BEFORE_ADVANCE * WORDS_PER_LINE
    const maxStart =
      words.length <= WINDOW_WORDS ? 0 : Math.max(0, words.length - WINDOW_WORDS)
    setChunkStart((c) => {
      let next = c
      while (currentWordIndex >= next + advanceBy) {
        const candidate = next + advanceBy
        if (candidate >= maxStart) return maxStart
        next = candidate
      }
      return next
    })
  }, [currentWordIndex, testActive, isIdle, words.length])

  const hasActiveInterim = interimForSpec.trim().length > 0
  const speculativeCount = hasActiveInterim
    ? wordStates
        .slice(currentWordIndex, currentWordIndex + MAX_SPECULATIVE_LOOKAHEAD)
        .filter((ws) => ws.status === 'speculative' || ws.status === 'correct')
        .length
    : 0

  useEffect(() => {
    emitDebugLog({
      sessionId: '26db2b',
      runId: 'post-fix',
      hypothesisId: 'H4_chunk_window',
      location: 'components/TestArea.tsx:chunkWindowEffect',
      message: 'Chunked passage window (advance every 2 lines)',
      data: {
        statusHysteresisMs: STATUS_HYSTERESIS_MS,
        hasActiveInterim,
        currentWordIndex,
        speculativeCount,
        chunkStart,
        wordsPerLine: WORDS_PER_LINE,
        wordsLength: words.length,
      },
      timestamp: Date.now(),
    })
  }, [hasActiveInterim, currentWordIndex, speculativeCount, chunkStart, words.length])

  const windowStart = testActive && !isIdle ? chunkStart : 0
  const windowEnd =
    testActive && !isIdle ? Math.min(words.length, chunkStart + WINDOW_WORDS) : words.length

  const visibleStates = useMemo(() => {
    if (testActive && !isIdle) {
      return wordStates.slice(windowStart, windowEnd).map((ws, localI) => ({
        ws,
        globalIndex: windowStart + localI,
      }))
    }
    return wordStates.map((ws, globalIndex) => ({ ws, globalIndex }))
  }, [wordStates, testActive, isIdle, windowStart, windowEnd])

  /** Same scale as globals `.word` / settings — active run and idle preview. */
  const testTextStyles: CSSProperties = {
    fontFamily: 'var(--font-mono), ui-monospace, monospace',
    fontSize: 'var(--test-font-size)',
    lineHeight: 'var(--test-line-height)',
  }

  const activeRunStyles: CSSProperties | undefined =
    testActive && !isIdle ? testTextStyles : undefined

  return (
    <div className="flex flex-col gap-4 items-stretch w-full">
      <div
        className={`select-none transition-all duration-300 w-full ${
          isIdle
            ? 'text-left overflow-hidden text-ellipsis'
            : testActive
              ? 'text-left overflow-x-hidden'
              : 'text-left leading-relaxed'
        }`}
        style={{
          maxWidth: '100%',
          ...(isIdle
            ? {
                ...testTextStyles,
                maxHeight: `calc(${ACTIVE_VISIBLE_LINES} * var(--test-line-height))`,
              }
            : {}),
          ...(testActive && !isIdle
            ? {
                /* Keep the active window to exactly three text lines. */
                maxHeight: `calc(${ACTIVE_VISIBLE_LINES} * var(--test-line-height))`,
                overflowY: 'hidden',
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
