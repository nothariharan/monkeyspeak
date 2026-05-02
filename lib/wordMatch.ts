/**
 * Normalise a token for ASR vs prompt comparison (Unicode, quotes, punctuation).
 */
export function normalizeWordToken(s: string): string {
  let t = s.normalize('NFKC').replace(/[\u2018\u2019\u201B\u2032\u2035]/g, "'")
  t = t.toLowerCase().replace(/[^a-z0-9']/g, '')
  return t.trim()
}

/** True if edit distance is at most 1 (ASR typos like presentaion / presentation). */
export function tokensRoughlyMatch(spoken: string, expected: string): boolean {
  const a = normalizeWordToken(spoken)
  const b = normalizeWordToken(expected)
  if (!a || !b) return a === b
  if (a === b) return true
  if (a.length < 3 || b.length < 3) return a === b
  if (Math.abs(a.length - b.length) > 1) return false

  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++
      j++
    } else {
      edits++
      if (edits > 1) return false
      if (a.length > b.length) i++
      else if (a.length < b.length) j++
      else {
        i++
        j++
      }
    }
  }
  return true
}
