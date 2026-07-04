import { evaluateAchievements } from '../achievements'
import type { SessionHistoryEntry } from '@/store/testStore'

type Lifetime = { totalRuns: number; totalWords: number; totalSeconds: number; totalFillers: number }

const NO_LIFETIME: Lifetime = { totalRuns: 0, totalWords: 0, totalSeconds: 0, totalFillers: 0 }

function entry(overrides: Partial<SessionHistoryEntry> = {}): SessionHistoryEntry {
  return {
    date: new Date().toISOString(),
    mode: 'speed',
    duration: 30,
    promptType: 'sentences',
    netWpm: 50,
    accuracy: 90,
    fillerCount: 3,
    ...overrides,
  }
}

describe('evaluateAchievements', () => {
  it('unlocks first_words after at least one run', () => {
    const result = evaluateAchievements([], { ...NO_LIFETIME, totalRuns: 1 }, entry())
    expect(result).toContain('first_words')
  })

  it('does not unlock first_words with zero runs', () => {
    const result = evaluateAchievements([], NO_LIFETIME, entry())
    expect(result).not.toContain('first_words')
  })

  it('unlocks howler_monkey at exactly 100 wpm in speed mode', () => {
    const result = evaluateAchievements([], NO_LIFETIME, entry({ netWpm: 100 }))
    expect(result).toContain('howler_monkey')
    expect(result).not.toContain('silverback')
  })

  it('unlocks silverback at 150+ wpm', () => {
    const result = evaluateAchievements([], NO_LIFETIME, entry({ netWpm: 155 }))
    expect(result).toContain('silverback')
    expect(result).toContain('howler_monkey')
  })

  it('does not award speed badges for a fast clarity run', () => {
    const result = evaluateAchievements([], NO_LIFETIME, entry({ mode: 'clarity', netWpm: 200 }))
    expect(result).not.toContain('howler_monkey')
    expect(result).not.toContain('silverback')
  })

  it('unlocks zen_chimp only for a 30s+ run with no fillers', () => {
    expect(evaluateAchievements([], NO_LIFETIME, entry({ duration: 30, fillerCount: 0 }))).toContain('zen_chimp')
    expect(evaluateAchievements([], NO_LIFETIME, entry({ duration: 15, fillerCount: 0 }))).not.toContain('zen_chimp')
    expect(evaluateAchievements([], NO_LIFETIME, entry({ duration: 60, fillerCount: 1 }))).not.toContain('zen_chimp')
  })

  it('unlocks yap_master for a 120s speed run', () => {
    expect(evaluateAchievements([], NO_LIFETIME, entry({ duration: 120 }))).toContain('yap_master')
  })

  it('unlocks clarity_s at 98%+ in clarity mode', () => {
    expect(evaluateAchievements([], NO_LIFETIME, entry({ mode: 'clarity', accuracy: 98 }))).toContain('clarity_s')
    expect(evaluateAchievements([], NO_LIFETIME, entry({ mode: 'clarity', accuracy: 97 }))).not.toContain('clarity_s')
  })

  it('unlocks twister_master for a tongue-twisters run at 85%+', () => {
    const result = evaluateAchievements([], NO_LIFETIME, entry({ promptType: 'tongue-twisters', accuracy: 85 }))
    expect(result).toContain('twister_master')
  })

  it('unlocks chatterbox at 2000+ lifetime words', () => {
    expect(evaluateAchievements([], { ...NO_LIFETIME, totalWords: 2000 }, entry())).toContain('chatterbox')
    expect(evaluateAchievements([], { ...NO_LIFETIME, totalWords: 1999 }, entry())).not.toContain('chatterbox')
  })

  it('preserves already-unlocked badges and does not duplicate them', () => {
    const result = evaluateAchievements(['first_words'], { ...NO_LIFETIME, totalRuns: 5 }, entry({ netWpm: 100 }))
    expect(result.filter((id) => id === 'first_words')).toHaveLength(1)
    expect(result).toContain('howler_monkey')
  })
})
