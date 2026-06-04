import { smithWatermanAlign } from '@/lib/dpAlign'
import { normalizeWordToken } from '@/lib/wordMatch'
import { isFiller } from '@/lib/fillers'
import type { DiffWord } from '@/store/testStore'
import type { EnrichedWord } from '@/hooks/useSpeechProvider'

/**
 * Align a full spoken transcript against the complete prompt array using
 * Smith-Waterman local sequence alignment.
 *
 * Called once at test end — no incremental / live alignment.
 */
export function alignTranscriptToPrompt(
  transcript: string,
  prompt: string[]
): DiffWord[] {
  const rawTokens = transcript
    .toLowerCase()
    .replace(/[^\w\s']/g, '')
    .split(/\s+/)
    .filter(Boolean)

  const spokenTokens: EnrichedWord[] = rawTokens
    .filter((w) => !isFiller(w))
    .map((w) => ({ word: w }))

  if (spokenTokens.length === 0) {
    return prompt.map((w) => ({ word: w, tag: 'missed' as const }))
  }

  // Pass the full prompt as the window; windowStart = 0 so promptIdx is absolute.
  const entries = smithWatermanAlign(spokenTokens, prompt, 0)

  // Build a map from promptIdx -> best spoken hit
  const coverage = new Map<number, { spokenWord: string; score: number }>()
  for (const e of entries) {
    if (e.spokenIdx !== null) {
      coverage.set(e.promptIdx, {
        spokenWord: spokenTokens[e.spokenIdx]!.word,
        score: e.matchScore,
      })
    }
  }

  return prompt.map((promptWord, i) => {
    const hit = coverage.get(i)
    if (!hit) return { word: promptWord, tag: 'missed' as const }
    if (hit.score >= 2) return { word: promptWord, tag: 'correct' as const }
    return {
      word: hit.spokenWord,
      tag: 'substituted' as const,
      expected: promptWord,
    }
  })
}

/** Count filler words in the raw transcript (before filler stripping). */
export function countFillers(transcript: string): number {
  return transcript
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => isFiller(w)).length
}
