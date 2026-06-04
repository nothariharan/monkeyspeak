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
