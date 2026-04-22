import type { DiffWord } from '@/store/testStore'

// ─── Normalise ────────────────────────────────────────────────────────────────

function normalise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, '')      // strip punctuation except apostrophes
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
}

// ─── Levenshtein distance ─────────────────────────────────────────────────────

function levenshtein(a: string[], b: string[]): number[][] {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }
  return dp
}

// ─── Backtrack to get edit operations ─────────────────────────────────────────

type Op = { type: 'match' | 'substitute' | 'insert' | 'delete'; src?: string; tgt?: string }

function backtrack(dp: number[][], a: string[], b: string[]): Op[] {
  const ops: Op[] = []
  let i = a.length
  let j = b.length

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ type: 'match', src: a[i - 1], tgt: b[j - 1] })
      i--; j--
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      ops.push({ type: 'substitute', src: a[i - 1], tgt: b[j - 1] })
      i--; j--
    } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      ops.push({ type: 'insert', tgt: b[j - 1] })
      j--
    } else {
      ops.push({ type: 'delete', src: a[i - 1] })
      i--
    }
  }

  return ops.reverse()
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Diff two strings word-by-word using Levenshtein alignment.
 *
 * @param promptStr   - The original prompt
 * @param transcriptStr - The user's transcribed output
 * @returns DiffWord[] array for rendering
 */
export function diffWords(promptStr: string, transcriptStr: string): DiffWord[] {
  const prompt     = normalise(promptStr)
  const transcript = normalise(transcriptStr)

  if (prompt.length === 0) return []

  const dp  = levenshtein(prompt, transcript)
  const ops = backtrack(dp, prompt, transcript)

  const result: DiffWord[] = []

  for (const op of ops) {
    switch (op.type) {
      case 'match':
        result.push({ word: op.src!, tag: 'correct' })
        break
      case 'substitute':
        result.push({ word: op.tgt!, tag: 'substituted', expected: op.src })
        break
      case 'insert':
        result.push({ word: op.tgt!, tag: 'added' })
        break
      case 'delete':
        result.push({ word: op.src!, tag: 'missed' })
        break
    }
  }

  return result
}

/**
 * Calculate clarity score and grade from a diff result.
 */
export function calcClarityScore(diff: DiffWord[], promptLength: number): {
  score: number
  grade: 'S' | 'A' | 'B' | 'C' | 'needs work'
} {
  if (promptLength === 0) return { score: 0, grade: 'needs work' }

  const correct = diff.filter((w) => w.tag === 'correct').length
  const score   = Math.round((correct / promptLength) * 100)

  let grade: 'S' | 'A' | 'B' | 'C' | 'needs work'
  if (score >= 98)      grade = 'S'
  else if (score >= 90) grade = 'A'
  else if (score >= 75) grade = 'B'
  else if (score >= 60) grade = 'C'
  else                  grade = 'needs work'

  return { score, grade }
}
