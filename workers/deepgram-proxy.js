/**
 * Cloudflare Worker — WebSocket proxy to Deepgram.
 * Deploy: npx wrangler deploy
 * Set NEXT_PUBLIC_DEEPGRAM_PROXY_URL=wss://<worker>.workers.dev/api/deepgram/proxy on Vercel
 */

function buildDeepgramUrl(searchParams) {
  const p = new URLSearchParams(searchParams)
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

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      })
    }

    const url = new URL(request.url)
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('MonkeySpeak Deepgram proxy OK', {
        headers: { 'Access-Control-Allow-Origin': '*' },
      })
    }

    if (!url.pathname.endsWith('/api/deepgram/proxy')) {
      return new Response('Not found', { status: 404 })
    }

    const apiKey = env.DEEPGRAM_API_KEY
    if (!apiKey) {
      return new Response('DEEPGRAM_API_KEY not configured', { status: 500 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    server.accept()

    const dgUrl = buildDeepgramUrl(url.searchParams)
    let dgWs

    dgWs = new WebSocket(dgUrl, {
      headers: { Authorization: `Token ${apiKey}` },
    })

    server.addEventListener('message', (event) => {
      if (dgWs.readyState === WebSocket.OPEN) dgWs.send(event.data)
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
