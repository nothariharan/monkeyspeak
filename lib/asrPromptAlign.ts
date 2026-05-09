import { isFiller } from '@/lib/fillers'
import { normalizeWordToken, tokensRoughlyMatch } from '@/lib/wordMatch'
import type { WordResult } from '@/store/testStore'
import type { EnrichedWord } from '@/hooks/useSpeechProvider'

// Keep aligned with `MAX_SPECULATIVE_LOOKAHEAD`: large lookahead + `tokensRoughlyMatch`
// makes common words match the wrong occurrence and skips multiple prompt slots in one
// final batch (visible cursor jumps). 4 is enough for short ASR lag.
const LOOKAHEAD = 4

/**
 * Map a batch of ASR tokens from one Deepgram `is_final` message onto the next
 * prompt positions. Handles: punctuation, light typos, duplicate/overlapping
 * finals, and brief ASR lag vs prompt index.
 *
 * Accepts EnrichedWord[] so that per-word timing and confidence from Deepgram
 * flow through into the resulting WordResult objects for Phase 2 WPM math.
 * WebSpeech tokens arrive as { word: string } with no timing fields.
 */
export function alignAsrFinalToPrompt(
  spokenTokens: EnrichedWord[],
  prompt: string[],
  startPromptIndex: number,
  onFiller: () => void
): WordResult[] {
  const out: WordResult[] = []
  let pi = startPromptIndex
  let ti = 0
  const now = () => Date.now()

  while (ti < spokenTokens.length) {
    const token = spokenTokens[ti]!
    const raw = token.word?.trim() ?? ''
    if (!raw) {
      ti++
      continue
    }

    const spokenNorm = normalizeWordToken(raw)
    const spokenLower = raw.toLowerCase().trim()

    if (isFiller(spokenLower)) {
      onFiller()
      ti++
      continue
    }

    if (pi >= prompt.length) {
      out.push({
        word: spokenNorm || spokenLower,
        isCorrect: false,
        isFiller: false,
        timestamp: now(),
        startTime: token.start,
        endTime: token.end,
        confidence: token.confidence,
      })
      ti++
      continue
    }

    // Duplicate / overlapping final: same token as last prompt word already consumed
    if (pi > 0 && tokensRoughlyMatch(raw, prompt[pi - 1] ?? '')) {
      ti++
      continue
    }

    const expected = prompt[pi] ?? ''

    if (tokensRoughlyMatch(raw, expected)) {
      out.push({
        word: spokenNorm || spokenLower,
        isCorrect: true,
        isFiller: false,
        timestamp: now(),
        startTime: token.start,
        endTime: token.end,
        confidence: token.confidence,
      })
      pi++
      ti++
      continue
    }

    let found = -1
    for (let k = 1; k <= LOOKAHEAD && pi + k < prompt.length; k++) {
      if (tokensRoughlyMatch(raw, prompt[pi + k] ?? '')) {
        found = k
        break
      }
    }

    if (found > 0) {
      // Emit auto-filled prompt words for the skipped slots (no timing data).
      for (let s = 0; s < found; s++) {
        const missed = prompt[pi + s] ?? ''
        out.push({
          word: normalizeWordToken(missed) || missed.toLowerCase(),
          isCorrect: true,
          isFiller: false,
          timestamp: now(),
        })
      }
      pi += found
      out.push({
        word: spokenNorm || spokenLower,
        isCorrect: true,
        isFiller: false,
        timestamp: now(),
        startTime: token.start,
        endTime: token.end,
        confidence: token.confidence,
      })
      pi++
      ti++
      continue
    }

    out.push({
      word: spokenNorm || spokenLower,
      isCorrect: false,
      isFiller: false,
      timestamp: now(),
      startTime: token.start,
      endTime: token.end,
      confidence: token.confidence,
    })
    pi++
    ti++
  }

  return out
}
