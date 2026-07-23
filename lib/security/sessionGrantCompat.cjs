/**
 * CommonJS twin of sessionGrant.ts for backend/index.js + server.js.
 * Keep algorithm in sync with the TypeScript module.
 */
const { createHmac, timingSafeEqual } = require('crypto')

function secret() {
  return (
    process.env.SESSION_SECRET ||
    process.env.DEEPGRAM_API_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'monkeyspeak-dev-insecure'
  )
}

function sign(payloadB64) {
  return createHmac('sha256', secret()).update(payloadB64).digest('base64url')
}

function safeEqual(a, b) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

function verifySessionGrant(token, purpose) {
  if (!token || typeof token !== 'string') return { ok: false, error: 'missing session' }
  const parts = token.split('.')
  if (parts.length !== 2) return { ok: false, error: 'invalid session' }
  const [payloadB64, sig] = parts
  if (!safeEqual(sign(payloadB64), sig)) return { ok: false, error: 'invalid session' }

  let payload
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
  } catch {
    return { ok: false, error: 'invalid session' }
  }

  if (payload.p !== purpose) return { ok: false, error: 'wrong session purpose' }
  if (!Number.isFinite(payload.exp) || payload.exp < Date.now()) {
    return { ok: false, error: 'session expired' }
  }
  return { ok: true, payload }
}

const DEEPGRAM_PARAM_ALLOWLIST = new Set([
  'model',
  'language',
  'lang',
  'encoding',
  'sample_rate',
  'channels',
  'smart_format',
  'interim_results',
  'vad_events',
  'endpointing',
  'no_delay',
  'filler_words',
  'utterance_end_ms',
  'session',
])

function buildDeepgramListenUrl(browserReqUrl) {
  const incoming = new URL(browserReqUrl, 'http://127.0.0.1')
  const raw = incoming.searchParams
  const p = new URLSearchParams()

  for (const [key, value] of raw.entries()) {
    if (!DEEPGRAM_PARAM_ALLOWLIST.has(key)) continue
    if (key === 'session') continue
    p.set(key, value)
  }

  if (p.has('lang') && !p.has('language')) {
    p.set('language', p.get('lang'))
    p.delete('lang')
  }

  const defaults = {
    model: 'nova-3',
    language: 'en-US',
    encoding: 'linear16',
    sample_rate: '16000',
    channels: '1',
    smart_format: 'false',
    interim_results: 'true',
    vad_events: 'true',
    endpointing: '10',
    no_delay: 'true',
    filler_words: 'true',
    utterance_end_ms: '1000',
  }
  if (p.has('utterance_end_ms')) {
    const ms = parseInt(p.get('utterance_end_ms'), 10)
    if (!Number.isFinite(ms) || ms < 1000) p.set('utterance_end_ms', '1000')
  }
  for (const [k, v] of Object.entries(defaults)) {
    if (!p.has(k)) p.set(k, v)
  }

  return `wss://api.deepgram.com/v1/listen?${p.toString()}`
}

const MAX_BUFFERED_FRAMES = 40

module.exports = {
  verifySessionGrant,
  buildDeepgramListenUrl,
  MAX_BUFFERED_FRAMES,
}
