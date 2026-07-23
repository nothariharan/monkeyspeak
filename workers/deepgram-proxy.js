/**
 * Cloudflare Worker — WebSocket proxy to Deepgram.
 * Deploy: npx wrangler deploy
 * Set NEXT_PUBLIC_DEEPGRAM_PROXY_URL=wss://<worker>.workers.dev/api/deepgram/proxy on Vercel
 *
 * Requires SESSION_SECRET (or DEEPGRAM_API_KEY) matching the Next app for HMAC session grants.
 */

const DEEPGRAM_PARAM_ALLOWLIST = new Set([
  'model', 'language', 'lang', 'encoding', 'sample_rate', 'channels',
  'smart_format', 'interim_results', 'vad_events', 'endpointing',
  'no_delay', 'filler_words', 'utterance_end_ms',
])

function buildDeepgramUrl(searchParams) {
  const p = new URLSearchParams()
  for (const [key, value] of searchParams.entries()) {
    if (!DEEPGRAM_PARAM_ALLOWLIST.has(key)) continue
    p.set(key, value)
  }
  if (p.has('lang') && !p.has('language')) {
    p.set('language', p.get('lang'))
    p.delete('lang')
  }
  if (p.has('utterance_end_ms')) {
    const ms = parseInt(p.get('utterance_end_ms'), 10)
    if (!Number.isFinite(ms) || ms < 1000) p.set('utterance_end_ms', '1000')
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
  for (const [k, v] of Object.entries(defaults)) {
    if (!p.has(k)) p.set(k, v)
  }
  return `wss://api.deepgram.com/v1/listen?${p.toString()}`
}

function b64urlEncode(buf) {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf
  let str = ''
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function verifySession(token, secret) {
  if (!token || typeof token !== 'string') return false
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [payloadB64, sig] = parts
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64))
  const expected = b64urlEncode(mac)
  if (expected !== sig) return false
  try {
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json)
    return payload.p === 'deepgram' && Number.isFinite(payload.exp) && payload.exp >= Date.now()
  } catch {
    return false
  }
}

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim())
    const origin = request.headers.get('Origin') || ''
    const allowOrigin = allowed.includes('*') || allowed.includes(origin) ? (origin || '*') : allowed[0] || '*'

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': allowOrigin,
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-MS-Session',
        },
      })
    }

    const url = new URL(request.url)
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('MonkeySpeak Deepgram proxy OK', {
        headers: { 'Access-Control-Allow-Origin': allowOrigin },
      })
    }

    if (!url.pathname.endsWith('/api/deepgram/proxy')) {
      return new Response('Not found', { status: 404 })
    }

    const apiKey = env.DEEPGRAM_API_KEY
    if (!apiKey) {
      return new Response('DEEPGRAM_API_KEY not configured', { status: 500 })
    }

    const secret = env.SESSION_SECRET || apiKey
    const session = url.searchParams.get('session') || request.headers.get('X-MS-Session')
    if (!(await verifySession(session, secret))) {
      return new Response('unauthorized', { status: 401 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    server.accept()

    const dgUrl = buildDeepgramUrl(url.searchParams)
    let dgWs
    const buffered = []
    const MAX_BUFFER = 40
    let dgOpen = false

    dgWs = new WebSocket(dgUrl, {
      headers: { Authorization: `Token ${apiKey}` },
    })

    server.addEventListener('message', (event) => {
      if (dgOpen && dgWs.readyState === WebSocket.OPEN) {
        dgWs.send(event.data)
      } else if (buffered.length < MAX_BUFFER) {
        buffered.push(event.data)
      } else {
        server.close(1008, 'buffer overflow')
        dgWs.close()
      }
    })

    dgWs.addEventListener('open', () => {
      dgOpen = true
      while (buffered.length > 0) {
        const msg = buffered.shift()
        if (dgWs.readyState === WebSocket.OPEN) dgWs.send(msg)
      }
    })

    dgWs.addEventListener('message', (event) => {
      if (server.readyState === WebSocket.OPEN) server.send(event.data)
    })

    server.addEventListener('close', () => dgWs.close())
    dgWs.addEventListener('close', () => server.close())
    server.addEventListener('error', () => dgWs.close(1011))
    dgWs.addEventListener('error', () => server.close(1011))

    return new Response(null, { status: 101, webSocket: client })
  },
}
