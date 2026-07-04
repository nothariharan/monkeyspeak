import { computeConsistency } from '../stats/consistency'

describe('computeConsistency', () => {
  it('returns 100 when there are fewer than 2 samples', () => {
    expect(computeConsistency([])).toBe(100)
    expect(computeConsistency([80])).toBe(100)
  })

  it('returns 100 for a perfectly steady pace', () => {
    expect(computeConsistency([50, 50, 50, 50])).toBe(100)
  })

  it('returns 100 when the mean is zero (avoids divide-by-zero)', () => {
    expect(computeConsistency([0, 0])).toBe(100)
  })

  it('maps a known coefficient of variation to the expected score', () => {
    // [10, 30]: mean 20, stdDev 10, CV 0.5 -> (1 - 0.5) * 100 = 50
    expect(computeConsistency([10, 30])).toBe(50)
  })

  it('clamps to 0 when variation exceeds the mean (CV > 1)', () => {
    // A huge outlier drives CV above 1, which would go negative before clamping
    expect(computeConsistency([1, 1, 100])).toBe(0)
  })

  it('never returns a value outside 0-100', () => {
    const score = computeConsistency([5, 95, 40, 60, 10])
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})
