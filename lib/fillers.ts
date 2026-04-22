/**
 * Filler words that are stripped from WPM count and trigger the flash animation.
 * From PRD §6.1
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

/**
 * Returns true if the given word (lowercased) is a filler word.
 */
export function isFiller(word: string): boolean {
  return FILLER_WORDS.has(word.toLowerCase().trim())
}
