import { isFiller } from '@/lib/fillers'
import { normalizeWordToken, tokensRoughlyMatch } from '@/lib/wordMatch'
import type { WordResult } from '@/store/testStore'

const LOOKAHEAD = 8

/**
 * Map a batch of ASR tokens from one Deepgram `is_final` message onto the next
 * prompt positions. Handles: punctuation, light typos, duplicate/overlapping
 * finals, and brief ASR lag vs prompt index.
 */
export function alignAsrFinalToPrompt(
  spokenTokens: string[],
  prompt: string[],
  startPromptIndex: number,
  onFiller: () => void
): WordResult[] {
  const out: WordResult[] = []
  let pi = startPromptIndex
  let ti = 0
  const now = () => Date.now()

  while (ti < spokenTokens.length) {
    const raw = spokenTokens[ti]?.trim() ?? ''
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
    })
    pi++
    ti++
  }

  return out
}
