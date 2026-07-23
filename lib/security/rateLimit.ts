type Entry = { count: number; resetAt: number }

const buckets = new Map<string, Entry>()

function prune(now: number) {
  if (buckets.size <= 800) return
  buckets.forEach((entry, key) => {
    if (entry.resetAt <= now) buckets.delete(key)
  })
}

/**
 * Sliding fixed-window limiter (in-memory; soft on serverless).
 * Returns false when the caller should be rejected.
 */
export function hitRateLimit(
  key: string,
  opts: { windowMs: number; max: number }
): boolean {
  const now = Date.now()
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs })
    prune(now)
    return true
  }
  if (existing.count >= opts.max) return false
  existing.count += 1
  return true
}

/** Back-compat cooldown: one hit per window. */
export function checkCooldown(key: string, windowMs: number): boolean {
  return hitRateLimit(key, { windowMs, max: 1 })
}
