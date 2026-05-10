/**
 * Consistency score derived from the coefficient of variation (CV) of per-word
 * raw WPM values.
 *
 * CV = σ / μ (standard deviation divided by mean).
 * Mapped linearly to 0–100: CV = 0 → 100%, CV ≥ 1 → 0%.
 * This matches MonkeyType's consistency metric semantics.
 */
export function computeConsistency(rawWpms: number[]): number {
  if (rawWpms.length < 2) return 100

  const mean = rawWpms.reduce((a, b) => a + b, 0) / rawWpms.length
  if (!mean || !Number.isFinite(mean)) return 100

  const variance =
    rawWpms.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / rawWpms.length
  const stdDev = Math.sqrt(variance)
  const cv = stdDev / mean

  // CV = 0 → consistency 100; CV = 1 → consistency 0; clamped to [0, 100]
  const raw = (1 - cv) * 100
  return Math.max(0, Math.min(100, Math.round(raw)))
}
