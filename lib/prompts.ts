import { COMMON_WORDS, EASY_WORDS, TECHNICAL_WORDS, HARD_WORDS, NUMBER_WORDS } from './wordLists'
import {
  getClarityPromptMeta,
  isClarityBankMode,
  pickClarityPrompt,
} from './clarityPrompts'
import type { PromptDifficulty } from '@/store/testStore'

export type { ClarityPromptEntry, ClarityPromptScene, ClaritySignal } from './clarityPrompts'
export { getClarityPromptMeta }

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

function clarityBenchmark(mode: PromptMode, lastText?: string): string {
  const bankMode = isClarityBankMode(mode) ? mode : 'sentences'
  return pickClarityPrompt(bankMode, lastText).text
}

/** Production-style passages used only by the external-tool clarity benchmark. */
export function generateClarityPrompt(
  mode: PromptMode,
  customText?: string,
  lastText?: string
): string {
  if (mode === 'custom' && customText?.trim()) return customText.trim()
  return clarityBenchmark(mode, lastText)
}

export function generatePrompt(
  mode: PromptMode,
  duration: number,
  customText?: string,
  difficulty: PromptDifficulty = 'normal'
): string {
  if (mode === 'custom' && customText) {
    return customText.trim().toLowerCase().replace(/\s+/g, ' ')
  }

  const wordCount = WORD_COUNTS[duration] ?? 90

  if (mode === 'technical' || mode === 'tongue-twisters') return clarityBenchmark(mode, undefined)

  const sentencesPool =
    difficulty === 'easy' ? EASY_WORDS :
    difficulty === 'hard' ? HARD_WORDS :
    COMMON_WORDS

  const poolMap: Record<PromptMode, string[]> = {
    sentences: sentencesPool,
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
  customText?: string,
  difficulty: PromptDifficulty = 'normal'
): string {
  if (mode === 'custom') return generatePrompt(mode, duration, customText)

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generatePrompt(mode, duration, undefined, difficulty)
    if (!lastPrompt || candidate.split(' ')[0] !== lastPrompt.split(' ')[0]) {
      return candidate
    }
  }
  return generatePrompt(mode, duration, undefined, difficulty)
}

/**
 * Build a practice prompt biased toward words the user missed or substituted.
 * 70% of slots are filled by sampling from missedWords (with repetition);
 * 30% are random words from COMMON_WORDS so the prompt isn't pure repetition.
 */
export function generatePracticePrompt(missedWords: string[], duration: number): string {
  const wordCount = WORD_COUNTS[duration] ?? 90
  if (missedWords.length === 0) return generatePrompt('sentences', duration)

  const pool = Array.from(new Set(missedWords.filter(Boolean)))
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

export function generateDailyPrompt(dateStr: string): string {
  // 90 words is standard for 30 seconds
  const wordCount = 90
  const pool = COMMON_WORDS

  // Mulberry32 seed random generator based on dateStr
  let h = 0
  for (let i = 0; i < dateStr.length; i++) {
    h = Math.imul(31, h) + dateStr.charCodeAt(i) | 0
  }
  const nextRand = () => {
    let t = h += 0x6D2B79F5
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const shuffleSeeded = <T>(array: T[]): T[] => {
    const arr = [...array]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(nextRand() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  const result: string[] = []
  let poolCopy = [...pool]
  let shuffled = shuffleSeeded(poolCopy)
  let idx = 0

  while (result.length < wordCount) {
    if (idx >= shuffled.length) {
      const lastWord = result[result.length - 1]
      shuffled = shuffleSeeded(pool.filter((w) => w !== lastWord))
      idx = 0
    }
    result.push(shuffled[idx]!)
    idx++
  }

  return result.join(' ')
}

