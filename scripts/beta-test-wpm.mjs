/**
 * Unit checks for WPM formulas (beta readiness).
 * Run: node scripts/beta-test-wpm.mjs
 */
import { netWpmFromChars, rawWpmFromChars, perWordRawWpm } from '../lib/stats/wpm.ts'

const failures = []

function assert(name, cond) {
  if (!cond) failures.push(name)
}

// 25 correct chars in 60s => (25/5) * (60/60) = 5 WPM
assert('netWpm 5 chars/sec equivalent', netWpmFromChars(25, 60) === 5)

// 50 all chars in 30s => (50/5) * (60/30) = 20 WPM
assert('rawWpm 20', rawWpmFromChars(50, 30) === 20)

// zero elapsed
assert('netWpm zero elapsed', netWpmFromChars(100, 0) === 0)
assert('rawWpm zero elapsed', rawWpmFromChars(100, 0) === 0)

// per-word burst: 4 char word in 1 second => (5/5)*60 = 60 WPM
assert('perWordRawWpm 60', perWordRawWpm(4, 1) === 60)

if (failures.length) {
  console.error('FAIL:', failures.join(', '))
  process.exit(1)
}
console.log('All WPM unit checks passed')
