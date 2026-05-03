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
    if (ok) return interimTokens.slice(k)
  }
  return interimTokens
}

export function useSpeculativeMatch({
  promptWords,
  confirmedWords,
  interimText,
}: UseSpeculativeMatchProps): PromptWordState[] {
  return useMemo(() => {
    const confirmedCount = confirmedWords.length
    const rawInterim = tokenizeInterim(interimText)
    const interimWords = stripInterimAlignedToConfirmedProgress(rawInterim, confirmedWords)

    return promptWords.map((promptWord, index) => {
      const clean = cleanToken(promptWord)

      if (index < confirmedCount) {
        const spokenWord = cleanToken(confirmedWords[index] ?? '')
        return {
          word: promptWord,
          status: spokenWord === clean ? 'correct' : 'wrong',
        }
      }

      const interimIndex = index - confirmedCount
      if (interimIndex < interimWords.length) {
        const interimWord = cleanToken(interimWords[interimIndex] ?? '')
        const speculative =
          (clean.length > 0 && interimWord.length > 0 && clean.startsWith(interimWord)) || interimWord === clean
        return {
          word: promptWord,
          status: speculative ? 'speculative' : 'wrong',
        }
      }

      if (index === confirmedCount + interimWords.length) {
        return { word: promptWord, status: 'current' }
      }

      return { word: promptWord, status: 'pending' }
    })
  }, [promptWords, confirmedWords, interimText])
}
