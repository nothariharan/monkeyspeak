const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const WebSocket = require('ws')
const { createClient: createDgClient } = require('@deepgram/sdk')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// merge browser query params into deepgram /v1/listen (lang → language etc)
function buildDeepgramListenUrl(reqUrl) {
  const incoming = new URL(reqUrl, 'http://127.0.0.1')
  const p = incoming.searchParams

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
    smart_format: 'true',
    interim_results: 'true',
    filler_words: 'true',
    vad_events: 'true',
    endpointing: '200',
    utterance_end_ms: '1000',
  }
  for (const [k, v] of Object.entries(defaults)) {
    if (!p.has(k)) p.set(k, v)
  }

  return `wss://api.deepgram.com/v1/listen?${p.toString()}`
}

app.prepare().then(async () => {
  const server = createServer((req, res) => {
    const parsed = parse(req.url, true)
    handle(req, res, parsed)
  })

  const wss = new WebSocket.Server({ noServer: true })

  let nextUpgradeHandler = null
  if (typeof app.getUpgradeHandler === 'function') {
    nextUpgradeHandler = await app.getUpgradeHandler()
  }

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url, true)

    if (pathname !== '/api/deepgram/proxy') {
      if (nextUpgradeHandler) {
        nextUpgradeHandler(req, socket, head)
      } else {
        socket.destroy()
      }
      return
    }

    wss.handleUpgrade(req, socket, head, async (browserWs) => {
      const apiKey = process.env.DEEPGRAM_API_KEY

      if (!apiKey) {
        console.error('[deepgram proxy] DEEPGRAM_API_KEY not configured')
        browserWs.close(1011, 'DEEPGRAM_API_KEY not configured')
        return
      }

      let wsToken = apiKey
      try {
        const dgClient = createDgClient(apiKey)
        const { result, error } = await dgClient.auth.grantToken()
        if (!error && result?.access_token) {
          wsToken = result.access_token
        } else {
          console.warn('[deepgram proxy] grantToken failed, falling back to raw key')
        }
      } catch (e) {
        console.warn('[deepgram proxy] grantToken threw:', e.message)
      }

      const dgUrl = buildDeepgramListenUrl(req.url)
      console.log('[deepgram proxy] opening upstream:', dgUrl.replace(/\?.*/, '?...'))

      const dgWs = new WebSocket(dgUrl, {
        headers: { Authorization: `Token ${wsToken}` },
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

      dgWs.on('unexpected-response', (_req, res) => {
        let body = ''
        res.on('data', chunk => { body += chunk })
        res.on('end', () => {
          console.error('[deepgram proxy] upstream rejected:', res.statusCode, body.slice(0, 500))
          browserWs.close(1011, 'upstream rejected')
        })
      })

      browserWs.on('close', cleanup)
      browserWs.on('error', (err) => {
        console.error('[deepgram proxy] browser error:', err.message)
        cleanup()
      })
    })
  })

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `[server] Port ${port} is already in use. Stop the other dev server (Ctrl+C) or run: Get-NetTCPConnection -LocalPort ${port} | % { Stop-Process -Id $_.OwningProcess -Force }`
      )
    } else {
      console.error('[server] listen error:', err.message)
    }
  })

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
