import { createHmac, timingSafeEqual } from 'crypto'

export type SessionPurpose = 'deepgram' | 'run'

type GrantPayload = {
  p: SessionPurpose
  exp: number
  d?: number
  pt?: string
  n: string
}

function secret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.DEEPGRAM_API_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'monkeyspeak-dev-insecure'
  )
}

function b64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buf.toString('base64url')
}

function sign(payloadB64: string): string {
  return createHmac('sha256', secret()).update(payloadB64).digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export function issueSessionGrant(
  purpose: SessionPurpose,
  opts: { ttlMs?: number; duration?: number; promptType?: string } = {}
): string {
  const payload: GrantPayload = {
    p: purpose,
    exp: Date.now() + (opts.ttlMs ?? 180_000),
    n: Math.random().toString(36).slice(2, 10),
  }
  if (opts.duration) payload.d = opts.duration
  if (opts.promptType) payload.pt = opts.promptType
  const payloadB64 = b64url(JSON.stringify(payload))
  return `${payloadB64}.${sign(payloadB64)}`
}

export function verifySessionGrant(
  token: string | null | undefined,
  purpose: SessionPurpose,
  opts: { duration?: number; promptType?: string } = {}
): { ok: true; payload: GrantPayload } | { ok: false; error: string } {
  if (!token || typeof token !== 'string') return { ok: false, error: 'missing session' }
  const parts = token.split('.')
  if (parts.length !== 2) return { ok: false, error: 'invalid session' }
  const [payloadB64, sig] = parts as [string, string]
  if (!safeEqual(sign(payloadB64), sig)) return { ok: false, error: 'invalid session' }

  let payload: GrantPayload
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as GrantPayload
  } catch {
    return { ok: false, error: 'invalid session' }
  }

  if (payload.p !== purpose) return { ok: false, error: 'wrong session purpose' }
  if (!Number.isFinite(payload.exp) || payload.exp < Date.now()) {
    return { ok: false, error: 'session expired' }
  }
  if (opts.duration != null && payload.d != null && payload.d !== opts.duration) {
    return { ok: false, error: 'session duration mismatch' }
  }
  if (opts.promptType != null && payload.pt != null && payload.pt !== opts.promptType) {
    return { ok: false, error: 'session prompt mismatch' }
  }
  return { ok: true, payload }
}
