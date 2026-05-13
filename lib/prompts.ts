import { COMMON_WORDS, TECHNICAL_WORDS, HARD_WORDS, NUMBER_WORDS } from './wordLists'

/** Matches store `PromptType` without importing the store. */
export type PromptMode =
  | 'sentences'
  | 'technical'
  | 'numbers'
  | 'hard'
  | 'custom'
  | 'tongue-twisters'

const WORD_COUNTS: Record<number, number> = {
  15: 45,
  30: 90,
  60: 180,
  120: 360,
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function pickWords(pool: string[], count: number): string[] {
  const result: string[] = []
  let shuffled = shuffle(pool)
  let i = 0

  while (result.length < count) {
    if (i >= shuffled.length) {
      const lastWord = result[result.length - 1]
      shuffled = shuffle(pool.filter((w) => w !== lastWord))
      i = 0
    }
    result.push(shuffled[i]!)
    i++
  }

  return result
}

export function generatePrompt(
  mode: PromptMode,
  duration: number,
  customText?: string
): string {
  if (mode === 'custom' && customText) {
    return customText.trim().toLowerCase().replace(/\s+/g, ' ')
  }

  const wordCount = WORD_COUNTS[duration] ?? 90

  const poolMap: Record<PromptMode, string[]> = {
    sentences: COMMON_WORDS,
    technical: TECHNICAL_WORDS,
    numbers: NUMBER_WORDS,
    hard: HARD_WORDS,
    custom: COMMON_WORDS,
    'tongue-twisters': HARD_WORDS,
  }

  const words = pickWords(poolMap[mode], wordCount)
  return words.join(' ')
}

export function regeneratePrompt(
  mode: PromptMode,
  duration: number,
  lastPrompt?: string,
  customText?: string
): string {
  if (mode === 'custom') return generatePrompt(mode, duration, customText)

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generatePrompt(mode, duration)
    if (!lastPrompt || candidate.split(' ')[0] !== lastPrompt.split(' ')[0]) {
      return candidate
    }
  }
  return generatePrompt(mode, duration)
}

/**
 * Build a practice prompt biased toward words the user missed or substituted.
 * 70% of slots are filled by sampling from missedWords (with repetition);
 * 30% are random words from COMMON_WORDS so the prompt isn't pure repetition.
 */
export function generatePracticePrompt(missedWords: string[], duration: number): string {
  const wordCount = WORD_COUNTS[duration] ?? 90
  if (missedWords.length === 0) return generatePrompt('sentences', duration)

  const pool = [...new Set(missedWords.filter(Boolean))]
  const fillCount = Math.round(wordCount * 0.7)
  const padCount = wordCount - fillCount

  const result: string[] = []
  let shuffledPool = shuffle(pool)
  let pi = 0
  for (let i = 0; i < fillCount; i++) {
    if (pi >= shuffledPool.length) {
      shuffledPool = shuffle(pool)
      pi = 0
    }
    result.push(shuffledPool[pi++]!)
  }

  const padWords = pickWords(COMMON_WORDS, padCount)
  result.push(...padWords)

  return shuffle(result).join(' ')
}
