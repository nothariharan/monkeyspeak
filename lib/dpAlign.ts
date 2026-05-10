/**
 * Smith-Waterman local sequence alignment for ASR-to-prompt matching.
 *
 * Scoring matrix (per cell):
 *   +3  exact normalized text match
 *   +2  Double Metaphone phonetic code match (catches homophones)
 *   +1  Levenshtein distance ≤ 1 (light typos / ASR substitutions)
 *   −1  gap (deletion or insertion in either sequence)
 *
 * Local alignment means the traceback starts from the highest-scoring cell,
 * so unspoken trailing prompt words are never penalised.
 */

import levenshtein from 'fast-levenshtein'
import { doubleMetaphone } from 'double-metaphone'
import { normalizeWordToken } from '@/lib/wordMatch'
import type { EnrichedWord } from '@/hooks/useSpeechProvider'

export interface AlignmentEntry {
  /** Index into the spoken token array, or null for an auto-filled gap. */
  spokenIdx: number | null
  /** Absolute index into the full prompt array (= windowStart + local promptIdx). */
  promptIdx: number
  /** The DP cell score that produced this alignment (0 for gap fills). */
  matchScore: number
}

const GAP = -1

/** Pre-compute normalized text and phonetic codes for a word. */
interface TokenInfo {
  norm: string
  codes: [string, string]
}

function tokenInfo(word: string): TokenInfo {
  const norm = normalizeWordToken(word)
  const codes = doubleMetaphone(norm) as [string, string]
  return { norm, codes }
}

function cellScore(spoken: TokenInfo, prompt: TokenInfo): number {
  if (!spoken.norm || !prompt.norm) return GAP

  if (spoken.norm === prompt.norm) return 3

  // Phonetic match — at least one non-empty code matches
  const [sa, sb] = spoken.codes
  const [pa, pb] = prompt.codes
  if (
    (sa && pa && sa === pa) ||
    (sa && pb && sa === pb) ||
    (sb && pa && sb === pa) ||
    (sb && pb && sb === pb)
  ) {
    return 2
  }

  if (levenshtein.get(spoken.norm, prompt.norm) <= 1) return 1

  return GAP
}

/**
 * Run Smith-Waterman local alignment between spoken tokens and a prompt window.
 *
 * @param spoken       Enriched spoken tokens (non-filler, already filtered)
 * @param promptWindow Prompt words sliced to the relevant window
 * @param windowStart  Absolute prompt index of promptWindow[0]
 */
export function smithWatermanAlign(
  spoken: EnrichedWord[],
  promptWindow: string[],
  windowStart: number
): AlignmentEntry[] {
  const m = spoken.length
  const n = promptWindow.length

  if (m === 0 || n === 0) return []

  const spokenInfo = spoken.map((t) => tokenInfo(t.word ?? ''))
  const promptInfo = promptWindow.map((w) => tokenInfo(w))

  // DP matrix — (m+1) × (n+1), Smith-Waterman initialised with zeros
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  // Traceback pointers: 'diag' | 'up' | 'left' | null
  const tb: (string | null)[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(null)
  )

  let bestScore = 0
  let bestI = 0
  let bestJ = 0

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const match = dp[i - 1]![j - 1]! + cellScore(spokenInfo[i - 1]!, promptInfo[j - 1]!)
      const del = dp[i - 1]![j]! + GAP   // spoken word not aligned (skip spoken)
      const ins = dp[i]![j - 1]! + GAP   // prompt word not aligned (skip prompt)
      const best = Math.max(0, match, del, ins)
      dp[i]![j] = best

      if (best === 0) {
        tb[i]![j] = null
      } else if (best === match) {
        tb[i]![j] = 'diag'
      } else if (best === del) {
        tb[i]![j] = 'up'
      } else {
        tb[i]![j] = 'left'
      }

      if (best > bestScore) {
        bestScore = best
        bestI = i
        bestJ = j
      }
    }
  }

  if (bestScore === 0) return []

  // Traceback
  const raw: AlignmentEntry[] = []
  let i = bestI
  let j = bestJ

  while (i > 0 && j > 0 && dp[i]![j]! > 0) {
    const dir = tb[i]![j]
    if (dir === 'diag') {
      raw.push({
        spokenIdx: i - 1,
        promptIdx: windowStart + j - 1,
        matchScore: cellScore(spokenInfo[i - 1]!, promptInfo[j - 1]!),
      })
      i--
      j--
    } else if (dir === 'up') {
      // Spoken token had no good prompt match — skip it (treat as incorrect later)
      raw.push({ spokenIdx: i - 1, promptIdx: windowStart + j, matchScore: GAP })
      i--
    } else {
      // Prompt word skipped — gap fill (no spoken index)
      raw.push({ spokenIdx: null, promptIdx: windowStart + j - 1, matchScore: 0 })
      j--
    }
  }

  // Traceback produces entries in reverse order
  raw.reverse()

  return raw
}
