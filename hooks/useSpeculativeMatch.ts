'use client'

import { useMemo } from 'react'
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
}

// 4 words of lookahead: safe now that debounce/hysteresis reductions give more
// stable speculative state. The high-water mark prevents backward jumps so
// increasing lookahead no longer causes 3-line cursor leaps. Don't go above 4 —
// at 5+ common words ("the", "a", "in") cause false-positive highlights.
export const MAX_SPECULATIVE_LOOKAHEAD = 12

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
 * Drop interim tokens that duplicate already-committed words.
 *
 * Web Speech `liveTranscript` only includes **non-final** segments, so after
 * words finalize they disappear from the interim string — the first token is
 * then aligned with `confirmed.length`, not index 0. We find the longest
 * prefix of `interimTokens` that matches a **suffix** of `confirmed` so the
 * remainder lines up with the next prompt position.
 */
function stripInterimAlignedToConfirmedProgress(
  interimTokens: string[],
  confirmed: string[]
): string[] {
  const progress = confirmed.length
  if (progress === 0 || interimTokens.length === 0) {
    return interimTokens
  }
  const maxK = Math.min(interimTokens.length, progress)
  for (let k = maxK; k >= 0; k--) {
    let ok = true
    for (let j = 0; j < k; j++) {
      if (!tokensRoughlyMatch(interimTokens[j]!, confirmed[progress - k + j]!)) {
        ok = false
        break
      }
    }
    if (ok) {
      const stripped = interimTokens.slice(k)
      // Safety bail-out: if we stripped more than (confirmedCount + 2) tokens,
      // the match is suspiciously aggressive and likely over-stripped — return
      // the full interim unchanged so the speculative window isn't starved.
      // This is the root cause of the "word never highlights" stuck-cursor bug.
      if (k > progress + 2) return interimTokens
      return stripped
    }
  }
  return interimTokens
}

export function useSpeculativeMatch({
  promptWords,
  confirmedWords,
  interimText,
}: UseSpeculativeMatchProps): PromptWordState[] {
  return useMemo(() => {
    // Use confirmedWords.length directly — the old peakConfirmedCount ratchet
    // could lock the cursor several words ahead when interim emissions spiked.
    const safeConfirmedCount = confirmedWords.length
    const rawInterim = tokenizeInterim(interimText)
    const interimWords = stripInterimAlignedToConfirmedProgress(rawInterim, confirmedWords)

    return promptWords.map((promptWord, index) => {
      const clean = cleanToken(promptWord)

      if (index < safeConfirmedCount) {
        if (index < confirmedWords.length) {
          const spokenWord = cleanToken(confirmedWords[index] ?? '')
          return {
            word: promptWord,
            status: spokenWord === clean ? 'correct' : 'wrong',
          }
        }
        return { word: promptWord, status: 'correct' as const }
      }

      const interimIndex = index - safeConfirmedCount
      if (
        interimIndex >= 0 &&
        interimIndex < interimWords.length &&
        interimIndex < MAX_SPECULATIVE_LOOKAHEAD
      ) {
        const interimWord = cleanToken(interimWords[interimIndex] ?? '')
        const speculative =
          clean.length > 0 &&
          interimWord.length > 0 &&
          (clean.startsWith(interimWord) || interimWord.startsWith(clean) || interimWord === clean)
        return {
          word: promptWord,
          status: speculative ? 'speculative' : 'wrong',
        }
      }

      if (index === safeConfirmedCount + interimWords.length) {
        return { word: promptWord, status: 'current' }
      }

      return { word: promptWord, status: 'pending' }
    })
  }, [promptWords, confirmedWords, interimText])
}
