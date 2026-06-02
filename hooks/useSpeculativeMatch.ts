'use client'

import { useMemo, useRef } from 'react'
import { tokensRoughlyMatch } from '@/lib/wordMatch'

export type WordStatus =
  | 'correct'
  | 'speculative'
  | 'wrong'
  | 'current'
  | 'pending'

export interface PromptWordState {
  word: string
  status: WordStatus
}

export interface UseSpeculativeMatchProps {
  promptWords: string[]
  confirmedWords: string[]
  interimText: string
  /** When true, suppress wrong status mid-test — words show as current instead of wrong */
  blindMode?: boolean
}

// Generous lookahead for the greedy scanner — how far ahead in the prompt we
// are willing to look when trying to match an interim token.  A large value
// handles users who skip words or where WebSpeech segments differently.
const PROMPT_SCAN_LOOKAHEAD = 5

function tokenizeInterim(interimText: string): string[] {
  return interimText
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
}

function cleanToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Check if two tokens match for speculative highlighting.
 * Uses exact match, edit-distance ≤ 1, and prefix matching.
 *
 * Edit-distance (tokensRoughlyMatch) has its own guards for very short words
 * (< 3 chars require exact), so we always try it. Prefix matching is restricted
 * to words > 3 chars to avoid "a" matching "an" etc.
 */
function tokensMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true

  // Edit distance ≤ 1 — always try (it has its own short-word guards)
  if (tokensRoughlyMatch(a, b)) return true

  // Prefix matching only for longer words to avoid false positives
  if (a.length > 3 && b.length > 3) {
    if (a.startsWith(b) && b.length >= 3) return true
    if (b.startsWith(a) && a.length >= 3) return true
  }

  return false
}

/**
 * Greedy forward scan alignment.
 *
 * Instead of strict positional alignment (interim[i] ↔ prompt[confirmed+i]),
 * this scans forward through the prompt for each interim token. This handles:
 *   - Words the user skips
 *   - Words WebSpeech hears differently
 *   - Different word boundaries / extra words
 *
 * Returns a Set of prompt indices (absolute) that were speculatively matched,
 * and the highest matched prompt index (for cursor positioning).
 */
function greedyForwardMatch(
  interimWords: string[],
  promptWords: string[],
  startIndex: number
): { matchedIndices: Set<number>; lastMatchedIndex: number } {
  const matchedIndices = new Set<number>()
  let promptCursor = startIndex
  let lastMatchedIndex = startIndex - 1

  for (let i = 0; i < interimWords.length; i++) {
    const interimClean = cleanToken(interimWords[i] ?? '')
    if (!interimClean) continue

    // Scan forward in prompt from current cursor, up to PROMPT_SCAN_LOOKAHEAD
    let bestJ = -1
    for (let j = promptCursor; j < Math.min(promptWords.length, promptCursor + PROMPT_SCAN_LOOKAHEAD); j++) {
      const promptClean = cleanToken(promptWords[j] ?? '')
      if (tokensMatch(interimClean, promptClean)) {
        bestJ = j
        break
      }
    }

    if (bestJ >= 0) {
      // Mark all words from promptCursor to bestJ (inclusive) as matched
      // Words between promptCursor and bestJ that weren't directly matched
      // are treated as "skipped" — we mark them as speculative too since
      // the user clearly progressed past them.
      for (let k = promptCursor; k <= bestJ; k++) {
        matchedIndices.add(k)
      }
      lastMatchedIndex = bestJ
      promptCursor = bestJ + 1
    }
    // If no match found, skip this interim token (don't advance promptCursor)
  }

  return { matchedIndices, lastMatchedIndex }
}

export function useSpeculativeMatch({
  promptWords,
  confirmedWords,
  interimText,
  blindMode = false,
}: UseSpeculativeMatchProps): PromptWordState[] {
  // Stability buffer: track the last match result to prevent single-frame flicker.
  // Only used for the "speculative → wrong" transition — once a word is speculative,
  // it stays speculative for at least one more render to prevent flashing.
  const prevMatchedRef = useRef<Set<number>>(new Set())
  const prevInterimRef = useRef('')

  return useMemo(() => {
    const safeConfirmedCount = confirmedWords.length
    const interimWords = tokenizeInterim(interimText)

    // Run greedy forward match on the interim tokens against the prompt
    const { matchedIndices, lastMatchedIndex } =
      interimWords.length > 0
        ? greedyForwardMatch(interimWords, promptWords, safeConfirmedCount)
        : { matchedIndices: new Set<number>(), lastMatchedIndex: safeConfirmedCount - 1 }

    // Merge with previous matches for hysteresis: a word that was speculative
    // last render stays speculative this render unless the interim text changed
    // (to prevent single-frame flicker when interim updates rapidly).
    const stableMatched = new Set(matchedIndices)
    if (interimText && interimText === prevInterimRef.current) {
      // Same interim text — keep previous matches
      Array.from(prevMatchedRef.current).forEach((idx) => {
        stableMatched.add(idx)
      })
    }

    // Update refs for next render
    prevMatchedRef.current = matchedIndices
    prevInterimRef.current = interimText

    // Determine cursor position: one past the last matched word, or
    // one past the last confirmed word if no interim matches.
    const cursorIndex = interimWords.length > 0
      ? Math.max(lastMatchedIndex + 1, safeConfirmedCount)
      : safeConfirmedCount

    const nextStates = promptWords.map((promptWord, index) => {
      const clean = cleanToken(promptWord)

      // ── Confirmed region ─────────────────────────────────────────────────
      if (index < safeConfirmedCount) {
        if (index < confirmedWords.length) {
          const spokenWord = cleanToken(confirmedWords[index] ?? '')
          const isWrong = spokenWord !== clean
          return {
            word: promptWord,
            status: (isWrong ? (blindMode ? 'correct' : 'wrong') : 'correct') as WordStatus,
          }
        }
        return { word: promptWord, status: 'correct' as const }
      }

      // ── Speculative region (between confirmed and cursor) ────────────────
      if (index < cursorIndex && interimWords.length > 0) {
        const isMatched = stableMatched.has(index)
        if (isMatched) {
          return { word: promptWord, status: 'speculative' as WordStatus }
        }
        // Word is between confirmed and cursor but wasn't matched —
        // the user may have skipped it or WebSpeech didn't hear it.
        // In blind mode, show as current; otherwise show as wrong.
        return {
          word: promptWord,
          status: (blindMode ? 'current' : 'wrong') as WordStatus,
        }
      }

      // ── Current word (cursor position) ───────────────────────────────────
      if (index === cursorIndex) {
        return { word: promptWord, status: 'current' as const }
      }

      // ── Pending (future words) ───────────────────────────────────────────
      return { word: promptWord, status: 'pending' as const }
    })

    return nextStates
  }, [promptWords, confirmedWords, interimText, blindMode])
}
