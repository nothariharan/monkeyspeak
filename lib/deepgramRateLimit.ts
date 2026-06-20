/**
 * Server-side budget guard for Deepgram API usage.
 *
 * Tracks cumulative seconds reserved per-IP and globally, resetting daily (UTC).
 * Caps are configurable via env vars — set in Vercel/Render dashboard, not code.
 *
 *   DEEPGRAM_SECONDS_PER_IP     default: 300  (5 min per IP per day)
 *   DEEPGRAM_SECONDS_GLOBAL     default: 3600 (60 min total per day)
 *
 * In-memory only — resets on cold-start. That's intentional: cold-starts happen
 * infrequently on Vercel and the slight budget leak is preferable to a database dep.
 */

type Bucket = { seconds: number; dayKey: string }

const ipBuckets = new Map<string, Bucket>()
let globalBucket: Bucket = { seconds: 0, dayKey: '' }

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function envInt(name: string, fallback: number): number {
  const v = process.env[name]
  if (!v) return fallback
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function ipCap()     { return envInt('DEEPGRAM_SECONDS_PER_IP', 300) }
function globalCap() { return envInt('DEEPGRAM_SECONDS_GLOBAL', 3600) }

function getIpBucket(ip: string): Bucket {
  const today = todayKey()
  const b = ipBuckets.get(ip)
  if (b?.dayKey === today) return b
  const fresh: Bucket = { seconds: 0, dayKey: today }
  ipBuckets.set(ip, fresh)
  return fresh
}

function getGlobalBucket(): Bucket {
  const today = todayKey()
  if (globalBucket.dayKey !== today) globalBucket = { seconds: 0, dayKey: today }
  return globalBucket
}

function pruneStaleIpBuckets() {
  if (ipBuckets.size <= 500) return
  const today = todayKey()
  ipBuckets.forEach((val, key) => {
    if (val.dayKey !== today) ipBuckets.delete(key)
  })
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; reason: 'ip_limit' | 'global_limit'; remainingSeconds: number }

/**
 * Check whether the IP has budget left, then reserve `durationSeconds` from both
 * the per-IP and global daily buckets.  Call this before opening a Deepgram session.
 */
export function checkAndReserveDeepgramSeconds(
  ip: string,
  durationSeconds: number,
): RateLimitResult {
  const ipB     = getIpBucket(ip)
  const globalB = getGlobalBucket()
  const perIp   = ipCap()
  const perGlob = globalCap()

  if (ipB.seconds + durationSeconds > perIp) {
    return {
      ok: false,
      reason: 'ip_limit',
      remainingSeconds: Math.max(0, perIp - ipB.seconds),
    }
  }

  if (globalB.seconds + durationSeconds > perGlob) {
    return {
      ok: false,
      reason: 'global_limit',
      remainingSeconds: Math.max(0, perGlob - globalB.seconds),
    }
  }

  ipB.seconds     += durationSeconds
  globalB.seconds += durationSeconds
  pruneStaleIpBuckets()
  return { ok: true }
}

export function getRemainingDeepgramSeconds(ip: string): { ip: number; global: number } {
  return {
    ip:     Math.max(0, ipCap()     - getIpBucket(ip).seconds),
    global: Math.max(0, globalCap() - getGlobalBucket().seconds),
  }
}
