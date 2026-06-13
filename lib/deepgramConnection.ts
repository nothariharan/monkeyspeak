/** Browser ↔ Deepgram connection helpers (proxy or direct JWT on Vercel). */

/** Deepgram live JSON may arrive as a text frame or a UTF-8 binary frame via WS proxies. */
export async function parseDeepgramWireMessage(data: unknown): Promise<string | null> {
  if (typeof data === 'string') return data
  if (data instanceof Blob) return data.text()
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data)
  return null
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
  url.searchParams.set('utterance_end_ms', '1000')
  return url.toString()
}

export function buildDeepgramProxyUrl(language: string): string | null {
  const base = process.env.NEXT_PUBLIC_DEEPGRAM_PROXY_URL
  if (!base || base === 'direct') return null

  try {
    const parsed = new URL(base)
    // Dev proxy URLs get baked into client bundles — ignore them off localhost.
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
  url.searchParams.set('utterance_end_ms', '1000')
  return url.toString()
}

/** Same-origin HTTP bridge — works on Brave/Edge where direct WS to Deepgram is blocked. */
export function buildDeepgramBridgeUrl(language: string): string {
  const url = new URL('/api/deepgram/live', typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
  url.searchParams.set('lang', language)
  url.searchParams.set('interim_results', 'true')
  url.searchParams.set('vad_events', 'true')
  url.searchParams.set('utterance_end_ms', '1000')
  return url.toString()
}

/** Always use same-origin HTTP bridge in the browser unless a remote WS proxy is configured. */
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

export async function fetchDeepgramAccessToken(): Promise<{ token: string } | { error: string }> {
  try {
    const r = await fetch('/api/deepgram/token', { method: 'POST', cache: 'no-store' })
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

export function isJwtDeepgramToken(token: string): boolean {
  return token.startsWith('eyJ') && token.split('.').length === 3
}

/**
 * Open a live listen socket from the browser.
 * Uses short ephemeral keys via the `token` subprotocol — JWTs are too long for
 * Sec-WebSocket-Protocol and fail the handshake in Chrome/Edge/Brave.
 */
export function openDeepgramWebSocket(listenUrl: string, token: string): WebSocket {
  if (isJwtDeepgramToken(token)) {
    console.warn(
      '[STT:deepgram] JWT too long for browser WebSocket — configure DEEPGRAM_PROJECT_ID for ephemeral keys or use a proxy.'
    )
    return new WebSocket(listenUrl, ['bearer', token])
  }
  return new WebSocket(listenUrl, ['token', token])
}
