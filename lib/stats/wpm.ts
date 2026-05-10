/**
 * MonkeyType 5-character standard WPM formulas.
 *
 * One "word" = 5 characters (including spaces). This is the industry-standard
 * normalisation used by MonkeyType, TypeRacer, and keybr — it eliminates the
 * bias of long vs short words that afflicts naive word-count WPM.
 */

/** Net WPM: correct characters only, divided by 5, per minute. */
export function netWpmFromChars(correctChars: number, elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0
  return Math.round((correctChars / 5) * (60 / elapsedSeconds))
}

/** Raw WPM: all typed/spoken characters (correct + incorrect), per minute. */
export function rawWpmFromChars(allChars: number, elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0
  return Math.round((allChars / 5) * (60 / elapsedSeconds))
}

/**
 * Per-word burst WPM using acoustic timestamps from Deepgram.
 *
 * Formula: ((wordLen + 1) / 5) * (60 / deltaSeconds)
 * +1 accounts for the trailing space after each word.
 *
 * @param wordLengthChars  Number of characters in the word (not including space)
 * @param deltaSeconds     Acoustic duration: endTime of this word minus endTime of previous correct word
 */
export function perWordRawWpm(wordLengthChars: number, deltaSeconds: number): number {
  if (deltaSeconds <= 0) return 0
  return Math.round(((wordLengthChars + 1) / 5) * (60 / deltaSeconds))
}

/**
 * Per-word burst WPM using wall-clock milliseconds (WebSpeech fallback).
 *
 * @param wordLengthChars Number of characters in the word
 * @param deltaMs         Wall-clock ms elapsed since the previous correct word's timestamp
 */
export function perWordRawWpmFromMs(wordLengthChars: number, deltaMs: number): number {
  if (deltaMs <= 0) return 0
  return perWordRawWpm(wordLengthChars, deltaMs / 1000)
}
