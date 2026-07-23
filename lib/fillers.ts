/**
 * Filler words that are stripped from WPM count and can trigger flash animation.
 * From PRD §6.1 — phrases need multi-token matching (see stripFillers).
 */
export const FILLER_WORDS = new Set([
  'um',
  'uh',
  'er',
  'like',
  'you know',
  'basically',
  'literally',
  'right',
  'so',
  'actually',
  'sort of',
  'kind of',
  'i mean',
  'you see',
  'well',
])

const SINGLE_FILLERS = new Set(
  Array.from(FILLER_WORDS).filter((w) => !w.includes(' ')).map((w) => w.toLowerCase())
)

const PHRASE_FILLERS = Array.from(FILLER_WORDS)
  .filter((w) => w.includes(' '))
  .map((w) => w.toLowerCase().split(/\s+/))
  .sort((a, b) => b.length - a.length)

function normalizeToken(word: string): string {
  return word.toLowerCase().replace(/[^\w']/g, '').trim()
}

/**
 * Returns true if the given single word (lowercased) is a single-token filler.
 * Prefer stripFillers() for transcripts — phrases need multi-token scan.
 */
export function isFiller(word: string): boolean {
  const n = normalizeToken(word)
  return SINGLE_FILLERS.has(n) || FILLER_WORDS.has(word.toLowerCase().trim())
}

/**
 * Strip fillers from a token stream, but keep tokens that match the next
 * expected prompt word(s) so legitimate content like "so" / "right" still scores.
 */
export function stripFillers(
  rawTokens: string[],
  promptWords: string[] = []
): { kept: string[]; fillerCount: number } {
  const tokens = rawTokens.map(normalizeToken).filter(Boolean)
  const prompt = promptWords.map(normalizeToken).filter(Boolean)
  const kept: string[] = []
  let fillerCount = 0
  let promptIdx = 0
  let i = 0

  while (i < tokens.length) {
    const nextExpected = prompt[promptIdx]

    // Multi-word fillers first (longest match)
    let phraseHit: string[] | null = null
    for (const phrase of PHRASE_FILLERS) {
      if (i + phrase.length > tokens.length) continue
      const slice = tokens.slice(i, i + phrase.length)
      if (slice.every((t, idx) => t === phrase[idx]!)) {
        phraseHit = phrase
        break
      }
    }

    if (phraseHit) {
      const matchesPrompt = phraseHit.every((t, idx) => prompt[promptIdx + idx] === t)
      if (matchesPrompt) {
        for (const t of phraseHit) {
          kept.push(t)
          promptIdx++
        }
      } else {
        fillerCount += 1
      }
      i += phraseHit.length
      continue
    }

    const token = tokens[i]!
    if (SINGLE_FILLERS.has(token) && token !== nextExpected) {
      fillerCount += 1
      i += 1
      continue
    }

    kept.push(token)
    if (token === nextExpected) promptIdx++
    i += 1
  }

  return { kept, fillerCount }
}
