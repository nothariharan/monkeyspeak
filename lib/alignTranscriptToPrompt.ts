import { smithWatermanAlign } from '@/lib/dpAlign'
import { normalizeWordToken } from '@/lib/wordMatch'
import { isFiller } from '@/lib/fillers'
import type { DiffWord } from '@/store/testStore'
import type { EnrichedWord } from '@/hooks/useSpeechProvider'

/**
 * end-of-run scoring: align what you said against the full prompt.
 * smith-waterman because people skip words, repeat stuff, and generally yap messy.
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

  // strip fillers before alignment — ums dont count as spoken words
  const spokenTokens: EnrichedWord[] = rawTokens
    .filter((w) => !isFiller(w))
    .map((w) => ({ word: w }))

  if (spokenTokens.length === 0) {
    return prompt.map((w) => ({ word: w, tag: 'missed' as const }))
  }

  // full prompt window, promptIdx is absolute from 0
  const entries = smithWatermanAlign(spokenTokens, prompt, 0)

  // promptIdx → best spoken match
  const coverage = new Map<number, { spokenWord: string; score: number }>()
  for (const e of entries) {
    if (e.spokenIdx !== null) {
      coverage.set(e.promptIdx, {
        spokenWord: spokenTokens[e.spokenIdx]!.word,
        score: e.matchScore,
      })
    }
  }

  // score 2+ = correct, below = substitution
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

// filler count on raw transcript before stripping
export function countFillers(transcript: string): number {
  return transcript
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => isFiller(w)).length
}
