const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const WebSocket = require('ws')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

/**
 * Merge browser query params into a Deepgram /v1/listen URL.
 * Maps `lang` → `language` (browser passes `lang`; Deepgram expects `language`).
 */
function buildDeepgramListenUrl(reqUrl) {
  const incoming = new URL(reqUrl, 'http://127.0.0.1')
  const p = incoming.searchParams

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
    smart_format: 'true',
    interim_results: 'true',
    filler_words: 'true',
    vad_events: 'true',
    endpointing: '200',
    utterance_end_ms: '200',
    no_delay: 'true',
  }
  for (const [k, v] of Object.entries(defaults)) {
    if (!p.has(k)) p.set(k, v)
  }

  return `wss://api.deepgram.com/v1/listen?${p.toString()}`
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url, true))
  })

  const wss = new WebSocket.Server({ noServer: true })

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url, true)

    if (pathname !== '/api/deepgram/proxy') {
      socket.destroy()
      return
    }

    wss.handleUpgrade(req, socket, head, (browserWs) => {
      const apiKey = process.env.DEEPGRAM_API_KEY

      if (!apiKey) {
        console.error('[deepgram proxy] DEEPGRAM_API_KEY not configured')
        browserWs.close(1011, 'DEEPGRAM_API_KEY not configured')
        return
      }

      const dgUrl = buildDeepgramListenUrl(req.url)
      console.log('[deepgram proxy] opening upstream:', dgUrl.replace(/\?.*/, '?...'))

      const dgWs = new WebSocket(dgUrl, {
        headers: { Authorization: `Token ${apiKey}` },
      })

      dgWs.on('open', () => {
        console.log('[deepgram proxy] upstream connected')
        browserWs.on('message', (data) => {
          if (dgWs.readyState === WebSocket.OPEN) dgWs.send(data)
        })
      })

      dgWs.on('message', (data) => {
        if (browserWs.readyState === WebSocket.OPEN) browserWs.send(data)
      })

      function cleanup() {
        if (dgWs.readyState < WebSocket.CLOSING) dgWs.close()
        if (browserWs.readyState < WebSocket.CLOSING) browserWs.close()
      }

      dgWs.on('close', cleanup)
      dgWs.on('error', (err) => {
        console.error('[deepgram proxy] upstream error:', err.message)
        cleanup()
      })
      browserWs.on('close', cleanup)
      browserWs.on('error', (err) => {
        console.error('[deepgram proxy] browser error:', err.message)
        cleanup()
      })
    })
  })

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
