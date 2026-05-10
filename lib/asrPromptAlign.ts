import { isFiller } from '@/lib/fillers'
import { normalizeWordToken } from '@/lib/wordMatch'
import { smithWatermanAlign } from '@/lib/dpAlign'
import type { WordResult } from '@/store/testStore'
import type { EnrichedWord } from '@/hooks/useSpeechProvider'

/**
 * Extra prompt words beyond the spoken count to include in the alignment
 * window. Handles large skips (speaker jumping ahead), repeated restarts,
 * and homophones — situations where the old 4-word LOOKAHEAD would fail.
 */
const WINDOW_EXTRA = 16

/**
 * Map a batch of ASR tokens from one Deepgram `is_final` message onto the next
 * prompt positions using Smith-Waterman local sequence alignment.
 *
 * Scoring: +3 exact, +2 phonetic (Double Metaphone), +1 edit-distance ≤ 1, −1 gap.
 * Traceback from the highest-scoring cell so unspoken trailing prompt words
 * are never penalised.
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
  const now = () => Date.now()

  // ── 1. Separate fillers from real tokens ────────────────────────────────
  const realTokens: EnrichedWord[] = []
  for (const token of spokenTokens) {
    const raw = token.word?.trim() ?? ''
    if (!raw) continue
    if (isFiller(raw.toLowerCase())) {
      onFiller()
    } else {
      realTokens.push(token)
    }
  }

  if (realTokens.length === 0) return []

  if (startPromptIndex >= prompt.length) {
    // Past end of prompt — mark everything incorrect
    return realTokens.map((token) => ({
      word: normalizeWordToken(token.word ?? '') || (token.word ?? '').toLowerCase(),
      isCorrect: false,
      isFiller: false,
      timestamp: now(),
      startTime: token.start,
      endTime: token.end,
      confidence: token.confidence,
    }))
  }

  // ── 2. Slice prompt window ───────────────────────────────────────────────
  const windowEnd = Math.min(prompt.length, startPromptIndex + realTokens.length + WINDOW_EXTRA)
  const promptWindow = prompt.slice(startPromptIndex, windowEnd)

  // ── 3. Run Smith-Waterman alignment ─────────────────────────────────────
  const entries = smithWatermanAlign(realTokens, promptWindow, startPromptIndex)

  if (entries.length === 0) {
    // Aligner found no alignment at all — mark all tokens incorrect
    return realTokens.map((token) => ({
      word: normalizeWordToken(token.word ?? '') || (token.word ?? '').toLowerCase(),
      isCorrect: false,
      isFiller: false,
      timestamp: now(),
      startTime: token.start,
      endTime: token.end,
      confidence: token.confidence,
    }))
  }

  // ── 4. Build WordResult[] from alignment entries ─────────────────────────
  // Sort by promptIdx so results come out in prompt order.
  const sorted = [...entries].sort((a, b) => a.promptIdx - b.promptIdx)

  const out: WordResult[] = []

  for (const entry of sorted) {
    const promptWord = prompt[entry.promptIdx] ?? ''
    const norm = normalizeWordToken(promptWord) || promptWord.toLowerCase()

    if (entry.spokenIdx === null) {
      // Gap-fill: prompt word was skipped — auto-fill as correct, no timing
      out.push({
        word: norm,
        isCorrect: true,
        isFiller: false,
        timestamp: now(),
      })
    } else {
      const token = realTokens[entry.spokenIdx]!
      const spokenNorm =
        normalizeWordToken(token.word ?? '') || (token.word ?? '').toLowerCase()

      if (entry.matchScore >= 2) {
        // Good phonetic or exact match — store the prompt word so the display
        // string-comparison in useSpeculativeMatch always resolves to 'correct'.
        out.push({
          word: norm,
          isCorrect: true,
          isFiller: false,
          timestamp: now(),
          startTime: token.start,
          endTime: token.end,
          confidence: token.confidence,
        })
      } else {
        // Weak or gap-penalty match — incorrect
        out.push({
          word: spokenNorm,
          isCorrect: false,
          isFiller: false,
          timestamp: now(),
          startTime: token.start,
          endTime: token.end,
          confidence: token.confidence,
        })
      }
    }
  }

  // ── 5. Recover spoken words dropped by the local alignment window ───────────
  // Smith-Waterman only traces back through the highest-scoring contiguous
  // region. Any spoken tokens before/after that window are simply absent from
  // `entries`. Those missing words must still advance currentWordIndex so
  // speculative matching stays aligned with the right prompt positions.
  const coveredSpoken = new Set(
    entries.filter((e) => e.spokenIdx !== null).map((e) => e.spokenIdx!)
  )
  const lastPromptIdx =
    sorted.length > 0
      ? sorted[sorted.length - 1]!.promptIdx
      : startPromptIndex - 1

  let nextDropIdx = lastPromptIdx + 1
  for (let i = 0; i < realTokens.length; i++) {
    if (!coveredSpoken.has(i)) {
      const token = realTokens[i]!
      const droppedNorm =
        normalizeWordToken(token.word ?? '') || (token.word ?? '').toLowerCase()
      out.push({
        word: droppedNorm,
        isCorrect: false,
        isFiller: false,
        timestamp: now(),
        startTime: token.start,
        endTime: token.end,
        confidence: token.confidence,
      })
      nextDropIdx++
    }
  }

  return out
}
