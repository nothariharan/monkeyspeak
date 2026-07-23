// browser ↔ deepgram helpers — proxy url, http bridge, wire parsing

// deepgram json can show up as text or utf-8 binary over ws proxies
export async function parseDeepgramWireMessage(data: unknown): Promise<string | null> {
  if (typeof data === 'string') return data
  if (data instanceof Blob) return data.text()
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data)
  return null
}

// live listen 400s below 1000ms — keep this constant everywhere
export const DEEPGRAM_UTTERANCE_END_MS = '1000'

// clamp bad utterance_end_ms from stale client bundles
export function clampUtteranceEndMs(params: URLSearchParams): void {
  if (!params.has('utterance_end_ms')) return
  const ms = parseInt(params.get('utterance_end_ms') ?? '', 10)
  if (!Number.isFinite(ms) || ms < 1000) params.set('utterance_end_ms', DEEPGRAM_UTTERANCE_END_MS)
}

export function buildDeepgramListenUrl(language: string): string {
  const url = new URL('wss://api.deepgram.com/v1/listen')
  url.searchParams.set('model', 'nova-3')
  url.searchParams.set('language', language)
  url.searchParams.set('encoding', 'linear16')
  url.searchParams.set('sample_rate', '16000')
  url.searchParams.set('channels', '1')
  url.searchParams.set('smart_format', 'false')
  url.searchParams.set('interim_results', 'true')
  url.searchParams.set('vad_events', 'true')
  url.searchParams.set('endpointing', '10')
  url.searchParams.set('no_delay', 'true')
  url.searchParams.set('filler_words', 'true')
  url.searchParams.set('utterance_end_ms', DEEPGRAM_UTTERANCE_END_MS)
  return url.toString()
}

export function buildDeepgramProxyUrl(language: string, session?: string): string | null {
  const base = process.env.NEXT_PUBLIC_DEEPGRAM_PROXY_URL
  if (!base || base === 'direct') return null

  try {
    const parsed = new URL(base)
    // dev proxy urls ship in the client bundle — ignore off localhost
    if (typeof window !== 'undefined') {
      const onLocalhost =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      const proxyIsLocal =
        parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
      if (proxyIsLocal && !onLocalhost) return null
    }
  } catch {
    return null
  }

  const url = new URL(base)
  url.searchParams.set('lang', language)
  url.searchParams.set('interim_results', 'true')
  url.searchParams.set('vad_events', 'true')
  if (session) url.searchParams.set('session', session)
  // utterance_end_ms lives on the proxy server not the query string
  return url.toString()
}

// same-origin http bridge — chrome/firefox prod path
export function buildDeepgramBridgeUrl(language: string, duration?: number, session?: string): string {
  const url = new URL('/api/deepgram/live', typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
  url.searchParams.set('lang', language)
  if (duration) url.searchParams.set('duration', String(duration))
  if (session) url.searchParams.set('session', session)
  return url.toString()
}

export function shouldUseDeepgramBridge(): boolean {
  return typeof window !== 'undefined'
}

export function proxyHttpOrigin(): string | null {
  const base = process.env.NEXT_PUBLIC_DEEPGRAM_PROXY_URL
  if (!base || base === 'direct') return null
  const u = new URL(base)
  const proto = u.protocol === 'wss:' ? 'https:' : 'http:'
  return `${proto}//${u.host}/`
}

export async function probeProxyBackendReachable(): Promise<{ ok: boolean; status?: number; err?: string }> {
  if (typeof window === 'undefined') {
    const origin = proxyHttpOrigin()
    if (!origin) return { ok: false, err: 'no proxy configured' }
    try {
      const r = await fetch(origin, { method: 'GET', cache: 'no-store' })
      return { ok: r.ok, status: r.status }
    } catch (e) {
      return { ok: false, err: String(e) }
    }
  }

  try {
    const r = await fetch('/api/deepgram/proxy-health', { cache: 'no-store' })
    if (!r.ok) return { ok: false, status: r.status, err: 'proxy health check failed' }
    return (await r.json()) as { ok: boolean; status?: number; err?: string }
  } catch (e) {
    return { ok: false, err: String(e) }
  }
}

export async function fetchDeepgramAccessToken(session?: string): Promise<{ token: string } | { error: string }> {
  try {
    const r = await fetch('/api/deepgram/token', {
      method: 'POST',
      cache: 'no-store',
      headers: session ? { 'X-MS-Session': session } : undefined,
    })
    if (!r.ok) {
      const body = (await r.json().catch(() => ({}))) as { error?: string }
      return { error: body.error ?? `Deepgram token unavailable (${r.status})` }
    }
    const data = (await r.json()) as { token?: string }
    if (!data.token) return { error: 'Deepgram token missing from server response' }
    return { token: data.token }
  } catch (e) {
    return { error: String(e) }
  }
}

export async function fetchDeepgramSession(duration: number): Promise<{ session: string } | { error: string }> {
  try {
    const r = await fetch('/api/deepgram/session', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration }),
    })
    const data = (await r.json().catch(() => ({}))) as { session?: string; error?: string }
    if (!r.ok) return { error: data.error ?? `Deepgram session unavailable (${r.status})` }
    if (!data.session) return { error: 'Deepgram session missing from server response' }
    return { session: data.session }
  } catch (e) {
    return { error: String(e) }
  }
}

export function isJwtDeepgramToken(token: string): boolean {
  return token.startsWith('eyJ') && token.split('.').length === 3
}

// ephemeral keys use the token subprotocol — full jwts are too long for ws handshake
export function openDeepgramWebSocket(listenUrl: string, token: string): WebSocket {
  if (isJwtDeepgramToken(token)) {
    console.warn(
      '[STT:deepgram] JWT too long for browser WebSocket — configure DEEPGRAM_PROJECT_ID for ephemeral keys or use a proxy.'
    )
    return new WebSocket(listenUrl, ['bearer', token])
  }
  return new WebSocket(listenUrl, ['token', token])
}
