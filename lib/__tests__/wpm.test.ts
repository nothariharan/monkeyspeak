import { netWpmFromChars, rawWpmFromChars } from '../stats/wpm'

describe('netWpmFromChars', () => {
  it('returns 0 for non-positive elapsed time', () => {
    expect(netWpmFromChars(500, 0)).toBe(0)
    expect(netWpmFromChars(500, -5)).toBe(0)
  })

  it('uses the 5-char standard word over a full minute', () => {
    // 500 chars / 5 = 100 words in 60s -> 100 wpm
    expect(netWpmFromChars(500, 60)).toBe(100)
  })

  it('scales correctly for sub-minute runs', () => {
    // 250 chars / 5 = 50 words in 30s -> 100 wpm
    expect(netWpmFromChars(250, 30)).toBe(100)
  })

  it('rounds to the nearest whole wpm', () => {
    // 123 chars / 5 = 24.6 words in 60s -> 25 wpm
    expect(netWpmFromChars(123, 60)).toBe(25)
  })

  it('returns 0 when no correct characters were produced', () => {
    expect(netWpmFromChars(0, 30)).toBe(0)
  })
})

describe('rawWpmFromChars', () => {
  it('returns 0 for non-positive elapsed time', () => {
    expect(rawWpmFromChars(500, 0)).toBe(0)
  })

  it('counts all spoken characters, not just correct ones', () => {
    // 600 chars / 5 = 120 words in 60s -> 120 wpm
    expect(rawWpmFromChars(600, 60)).toBe(120)
  })
})
