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

// Small lookahead limits false matches on common words ("the", "to", …).
export const MAX_SPECULATIVE_LOOKAHEAD = 4

// Prompt words this short require an exact match rather than a prefix match
// to avoid false highlights on "a", "an", "in", "of", "the", etc.
const SHORT_WORD_EXACT_THRESHOLD = 3

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
  blindMode = false,
}: UseSpeculativeMatchProps): PromptWordState[] {
  // ── Stability buffer ────────────────────────────────────────────────────────
  // Tracks the last 3 *aligned* interim token arrays. A position is only marked
  // speculative once the same token has appeared there in at least 2 of the last
  // 3 updates (~80–120 ms on Deepgram's cadence), preventing single-frame flickers
  // on short, ambiguous phonemes.
  //
  // Both refs are updated synchronously during render (before useMemo) when
  // interimText changes. Updating refs during render is a documented React
  // pattern and is safe here because the computation is deterministic.
  const interimHistoryRef = useRef<string[][]>([])
  const prevInterimTextRef = useRef('')

  return useMemo(() => {
    // Use confirmedWords.length directly — the old peakConfirmedCount ratchet
    // could lock the cursor several words ahead when interim emissions spiked.
    const safeConfirmedCount = confirmedWords.length
    const rawInterim = tokenizeInterim(interimText)
    const interimWords = stripInterimAlignedToConfirmedProgress(rawInterim, confirmedWords)

    // Update interim history for this render cycle.
    if (interimText !== prevInterimTextRef.current) {
      prevInterimTextRef.current = interimText
      if (interimText === '') {
        // Clear history when the interim is wiped between words so stale
        // snapshots from the previous word don't affect the next word's count.
        interimHistoryRef.current = []
      } else {
        const next = [...interimHistoryRef.current, interimWords]
        interimHistoryRef.current = next.length > 3 ? next.slice(-3) : next
      }
    }

    const history = interimHistoryRef.current

    const nextStates = promptWords.map((promptWord, index) => {
      const clean = cleanToken(promptWord)

      if (index < safeConfirmedCount) {
        if (index < confirmedWords.length) {
          const spokenWord = cleanToken(confirmedWords[index] ?? '')
          const isWrong = spokenWord !== clean
          return {
            word: promptWord,
            // In blind mode, suppress wrong coloring — show as correct so users focus on rhythm
            status: (isWrong ? (blindMode ? 'correct' : 'wrong') : 'correct') as WordStatus,
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

        // Stability gate: always accept on the first update (historyLen=1).
        // From the second update onward, only one consistent snapshot is
        // required (down from 2) so words light up ~100–300ms faster.
        const requiredMatches = 1
        const stableCount = history.filter(
          (h) => cleanToken(h[interimIndex] ?? '') === interimWord
        ).length
        const isStable = stableCount >= requiredMatches

        // Short-word exact-match guard: for words of 1–3 characters ("a",
        // "an", "in", "of", "the") require an exact cleaned match instead of
        // the prefix rule. Prefix-only matching on short words produces too
        // many false positives (e.g. "h" matching "he", "her", "here").
        const isExactRequired = clean.length <= SHORT_WORD_EXACT_THRESHOLD

        const speculative =
          clean.length > 0 &&
          interimWord.length > 0 &&
          isStable &&
          (isExactRequired ? interimWord === clean : clean.startsWith(interimWord))

        return {
          word: promptWord,
          status: (speculative ? 'speculative' : blindMode ? 'current' : 'wrong') as WordStatus,
        }
      }

      if (index === safeConfirmedCount + interimWords.length) {
        return { word: promptWord, status: 'current' as const }
      }

      return { word: promptWord, status: 'pending' as const }
    })
    return nextStates
  }, [promptWords, confirmedWords, interimText, blindMode])
}
