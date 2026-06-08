import { tokensRoughlyMatch } from '@/lib/wordMatch'

export type WordState = 'pending' | 'current' | 'correct' | 'incorrect'

export type GameEventType = 'correct' | 'incorrect' | 'missed'

export interface GameEvent {
  type: GameEventType
  index: number
  word: string
}

export interface LiveScorerSnapshot {
  wordStates: WordState[]
  currentIndex: number
  streak: number
  height: number
  correctCount: number
  incorrectCount: number
  missedCount: number
  events: GameEvent[]
}

const LOOKAHEAD = 3
const HEIGHT_CORRECT = 1
const HEIGHT_INCORRECT = -0.5
const HEIGHT_MISSED = -0.3

function buildInitialStates(promptLength: number): WordState[] {
  if (promptLength === 0) return []
  const states: WordState[] = Array(promptLength).fill('pending')
  states[0] = 'current'
  return states
}

/**
 * Stateful greedy live matcher — processes one confirmed spoken word at a time.
 * Uses a small lookahead window so a single skip doesn't desync the pointer.
 */
export class LiveScorer {
  private prompt: string[]
  private pointer = 0
  private wordStates: WordState[]
  private streak = 0
  private height = 0
  private correctCount = 0
  private incorrectCount = 0
  private missedCount = 0
  private pendingEvents: GameEvent[] = []

  constructor(prompt: string[]) {
    this.prompt = prompt
    this.wordStates = buildInitialStates(prompt.length)
  }

  reset(prompt: string[]) {
    this.prompt = prompt
    this.pointer = 0
    this.wordStates = buildInitialStates(prompt.length)
    this.streak = 0
    this.height = 0
    this.correctCount = 0
    this.incorrectCount = 0
    this.missedCount = 0
    this.pendingEvents = []
  }

  /** Process a batch of newly confirmed spoken words (final STT tokens). */
  processWords(spokenWords: string[]): LiveScorerSnapshot {
    for (const spoken of spokenWords) {
      if (this.pointer >= this.prompt.length) break
      this.resolveSpokenWord(spoken)
    }
    return this.snapshot()
  }

  private resolveSpokenWord(spoken: string) {
    if (this.pointer >= this.prompt.length) return

    let matchIndex: number | null = null
    for (let offset = 0; offset <= LOOKAHEAD; offset++) {
      const idx = this.pointer + offset
      if (idx >= this.prompt.length) break
      if (tokensRoughlyMatch(spoken, this.prompt[idx]!)) {
        matchIndex = idx
        break
      }
    }

    if (matchIndex === null) {
      this.markIncorrect(this.pointer, spoken)
      return
    }

    for (let i = this.pointer; i < matchIndex; i++) {
      this.markMissed(i)
    }
    this.markCorrect(matchIndex, this.prompt[matchIndex]!)
  }

  private markCorrect(index: number, word: string) {
    this.wordStates[index] = 'correct'
    this.pointer = index + 1
    this.streak++
    this.height += HEIGHT_CORRECT
    this.correctCount++
    this.pendingEvents.push({ type: 'correct', index, word })
    this.updateCurrentPointer()
  }

  private markIncorrect(index: number, spoken: string) {
    this.wordStates[index] = 'incorrect'
    this.pointer = index + 1
    this.streak = 0
    this.height = Math.max(0, this.height + HEIGHT_INCORRECT)
    this.incorrectCount++
    this.pendingEvents.push({ type: 'incorrect', index, word: spoken })
    this.updateCurrentPointer()
  }

  private markMissed(index: number) {
    this.wordStates[index] = 'incorrect'
    this.streak = 0
    this.height = Math.max(0, this.height + HEIGHT_MISSED)
    this.missedCount++
    this.pendingEvents.push({ type: 'missed', index, word: this.prompt[index]! })
  }

  private updateCurrentPointer() {
    if (this.pointer < this.prompt.length) {
      if (this.wordStates[this.pointer] === 'pending') {
        this.wordStates[this.pointer] = 'current'
      }
    }
  }

  /** Drain and return pending animation events (consumed once per tick). */
  drainEvents(): GameEvent[] {
    const events = this.pendingEvents
    this.pendingEvents = []
    return events
  }

  getHeight(): number {
    return Math.round(this.height)
  }

  getStreak(): number {
    return this.streak
  }

  getCurrentIndex(): number {
    return Math.min(this.pointer, this.prompt.length)
  }

  snapshot(): LiveScorerSnapshot {
    return {
      wordStates: [...this.wordStates],
      currentIndex: this.getCurrentIndex(),
      streak: this.streak,
      height: this.getHeight(),
      correctCount: this.correctCount,
      incorrectCount: this.incorrectCount,
      missedCount: this.missedCount,
      events: [...this.pendingEvents],
    }
  }
}
