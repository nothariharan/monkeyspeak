'use client'

import { useEffect, useMemo, useRef, useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import type { WordResult } from '@/store/testStore'
import {
  useSpeculativeMatch,
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
  /** When true, suppress wrong-word coloring mid-test (blind mode) */
  blindMode?: boolean
}

/** Lines shown in the viewport during an active test */
const ACTIVE_VISIBLE_LINES = 3
/** Number of completed lines before the container scrolls */
const LINES_BEFORE_SCROLL = 1

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

function Word({
  state,
  idlePreview,
  wordRef,
}: {
  state: PromptWordState
  idlePreview?: boolean
  wordRef?: (el: HTMLSpanElement | null) => void
}) {
  const [stableStatus, setStableStatus] = useState<WordStatus>(state.status)

  useEffect(() => {
    if (idlePreview) {
      setStableStatus(state.status)
      return
    }
    const shouldDelay = state.status === 'speculative' || state.status === 'wrong'
    if (!shouldDelay) {
      setStableStatus(state.status)
      return
    }
    const t = window.setTimeout(() => {
      setStableStatus(state.status)
    }, STATUS_HYSTERESIS_MS)
    return () => window.clearTimeout(t)
  }, [state.status, idlePreview])

  // The delay only applies to speculative/wrong; all other transitions are immediate
  const shouldDelay = state.status === 'speculative' || state.status === 'wrong'
  const displayStatus = idlePreview || !shouldDelay ? state.status : stableStatus

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
      ref={wordRef}
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
  blindMode = false,
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
    blindMode: testActive && !isIdle ? blindMode : false,
  })

  // ── Continuous scroll via CSS translateY ──────────────────────────────────
  const containerRef = useRef<HTMLDivElement | null>(null)
  const wordRefsMap = useRef<Map<number, HTMLSpanElement>>(new Map())

  const setWordRef = useCallback((index: number) => (el: HTMLSpanElement | null) => {
    if (el) {
      wordRefsMap.current.set(index, el)
    } else {
      wordRefsMap.current.delete(index)
    }
  }, [])

  // Reset scroll offset when the prompt changes or test becomes idle
  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.style.transform = 'translateY(0)'
    containerRef.current.style.transition = 'none'
  }, [words, isIdle])

  useEffect(() => {
    if (!testActive || isIdle) return
    const container = containerRef.current
    if (!container) return

    const currentEl = wordRefsMap.current.get(currentWordIndex)
    if (!currentEl) return

    const containerRect = container.parentElement?.getBoundingClientRect()
    if (!containerRect) return

    // Compute the line height from the element itself
    const lineHeight = parseFloat(getComputedStyle(currentEl).lineHeight) || currentEl.offsetHeight

    // How many lines from the top of the container to the current word
    const wordTop = currentEl.offsetTop
    // Only scroll when the current word has moved past LINES_BEFORE_SCROLL visible lines
    const scrollThreshold = LINES_BEFORE_SCROLL * lineHeight
    const targetTranslate = wordTop > scrollThreshold ? -(wordTop - scrollThreshold) : 0

    container.style.transition = 'transform 0.2s ease'
    container.style.transform = `translateY(${targetTranslate}px)`
  }, [currentWordIndex, testActive, isIdle])

  const visibleStates = useMemo(
    () => wordStates.map((ws, globalIndex) => ({ ws, globalIndex })),
    [wordStates]
  )

  const testTextStyles: CSSProperties = {
    fontFamily: 'var(--font-mono), ui-monospace, monospace',
    fontSize: 'var(--test-font-size)',
    lineHeight: 'var(--test-line-height)',
  }

  return (
    <div className="flex flex-col gap-4 items-stretch w-full">
      {/* Outer clip box — fixed height during active test */}
      <div
        style={{
          maxWidth: '100%',
          ...(isIdle
            ? {
                ...testTextStyles,
                maxHeight: `calc(${ACTIVE_VISIBLE_LINES} * var(--test-line-height))`,
                overflow: 'hidden',
              }
            : testActive
              ? {
                  maxHeight: `calc(${ACTIVE_VISIBLE_LINES} * var(--test-line-height))`,
                  overflow: 'hidden',
                  paddingBottom: 4,
                }
              : {}),
        }}
        aria-label="Speaking prompt"
        aria-live="polite"
      >
        {/* Inner container — this is what we translateY */}
        <div
          ref={containerRef}
          className="select-none w-full text-left"
          style={{
            ...(testActive && !isIdle ? testTextStyles : {}),
          }}
        >
          {visibleStates.map(({ ws, globalIndex }) => (
            <Word
              key={`${globalIndex}-${ws.word}`}
              state={ws}
              idlePreview={isIdle}
              wordRef={testActive && !isIdle ? setWordRef(globalIndex) : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
