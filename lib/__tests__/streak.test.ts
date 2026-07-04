import { calculateSpeakingStreak } from '../stats/streak'

// Build a local "YYYY-MM-DD" key offset from today, matching getLocalDateStr().
function dayKey(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

describe('calculateSpeakingStreak', () => {
  it('returns 0 for an empty activity map', () => {
    expect(calculateSpeakingStreak({})).toBe(0)
  })

  it('returns 0 for a null/undefined activity map', () => {
    // @ts-expect-error exercising the runtime guard
    expect(calculateSpeakingStreak(undefined)).toBe(0)
  })

  it('counts a single run today as a streak of 1', () => {
    expect(calculateSpeakingStreak({ [dayKey(0)]: 1 })).toBe(1)
  })

  it('counts consecutive days including today', () => {
    expect(
      calculateSpeakingStreak({ [dayKey(0)]: 2, [dayKey(-1)]: 1, [dayKey(-2)]: 3 })
    ).toBe(3)
  })

  it('still counts the streak when today has no run but yesterday does', () => {
    expect(calculateSpeakingStreak({ [dayKey(-1)]: 1, [dayKey(-2)]: 1 })).toBe(2)
  })

  it('stops at the first gap', () => {
    // today present, yesterday missing, two days ago present -> only today counts
    expect(calculateSpeakingStreak({ [dayKey(0)]: 1, [dayKey(-2)]: 1 })).toBe(1)
  })

  it('returns 0 when the most recent run is older than yesterday', () => {
    expect(calculateSpeakingStreak({ [dayKey(-3)]: 1 })).toBe(0)
  })
})
