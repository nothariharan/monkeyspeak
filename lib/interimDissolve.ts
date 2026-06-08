import { tokensRoughlyMatch } from '@/lib/wordMatch'

const LOOKAHEAD = 3

/**
 * Align interim STT tokens to the prompt starting at `startIndex`.
 * Returns how many prompt words should be dissolved (startIndex + matched count).
 */
export function computeInterimDissolveIndex(
  interimText: string | string[],
  prompt: string[],
  startIndex: number
): number {
  const tokens = Array.isArray(interimText)
    ? interimText
        .map((token) => token.toLowerCase().replace(/[^a-z0-9']/g, '').trim())
        .filter(Boolean)
    : interimText
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s']/g, '')
        .split(/\s+/)
        .filter(Boolean)

  if (tokens.length === 0) return startIndex

  let pointer = startIndex
  let tokenIdx = 0

  while (tokenIdx < tokens.length && pointer < prompt.length) {
    const spoken = tokens[tokenIdx]!
    let matchIndex: number | null = null

    for (let offset = 0; offset <= LOOKAHEAD; offset++) {
      const idx = pointer + offset
      if (idx >= prompt.length) break
      if (tokensRoughlyMatch(spoken, prompt[idx]!)) {
        matchIndex = idx
        break
      }
    }

    if (matchIndex === null) break

    pointer = matchIndex + 1
    tokenIdx++
  }

  return Math.min(pointer, prompt.length)
}
