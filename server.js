const { createServer } = require('http')
const { parse } = require('url')
const fs = require('fs')
const path = require('path')
const next = require('next')
const WebSocket = require('ws')
const { createClient: createDgClient } = require('@deepgram/sdk')

// #region agent log — NDJSON (session b9a7e7); no secrets
/** In-memory ring (always works). Files may be gitignored / unsynced in Cursor. */
const B9_RING = []
const B9_RING_MAX = 150
globalThis.__B9_DBG_RING__ = B9_RING

let _b9LastDiskSnapshot = 0
/** Throttled JSON snapshot for IDE agents (not gitignored). */
function b9WriteRingSnapshot() {
  const now = Date.now()
  if (now - _b9LastDiskSnapshot < 1500) return
  _b9LastDiskSnapshot = now
  const snap = JSON.stringify(
    { sessionId: 'b9a7e7', updatedAt: now, count: B9_RING.length, lines: B9_RING },
    null,
    2
  )
  for (const base of [__dirname, process.cwd()]) {
    try {
      fs.writeFileSync(path.join(base, 'b9-debug-ring.json'), snap, 'utf8')
    } catch {
      /* ignore */
    }
  }
}

/** Tool-readable (not matched by debug-*.log gitignore). Also mirror to debug-b9a7e7.log for humans. */
function dbgFile(payload) {
  const entry = {
    sessionId: 'b9a7e7',
    timestamp: Date.now(),
    ...payload,
  }
  B9_RING.push(entry)
  if (B9_RING.length > B9_RING_MAX) B9_RING.shift()
  b9WriteRingSnapshot()

  const line = JSON.stringify(entry)
  const bases = [__dirname, process.cwd()]
  for (const base of bases) {
    try {
      fs.appendFileSync(path.join(base, 'trace-b9a7e7.ndjson'), `${line}\n`, 'utf8')
    } catch {
      /* ignore */
    }
  }
  for (const base of bases) {
    try {
      fs.appendFileSync(path.join(base, 'b9a7e7-agent.ndjson'), `${line}\n`, 'utf8')
    } catch {
      /* ignore */
    }
  }
  for (const base of bases) {
    try {
      fs.appendFileSync(path.join(base, 'debug-b9a7e7.log'), `${line}\n`, 'utf8')
    } catch {
      /* ignore */
    }
  }
}
// #endregion

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
  }
  for (const [k, v] of Object.entries(defaults)) {
    if (!p.has(k)) p.set(k, v)
  }

  return `wss://api.deepgram.com/v1/listen?${p.toString()}`
}

app.prepare().then(async () => {
  // #region agent log — proves this file executed; dual-path file write
  dbgFile({
    hypothesisId: 'H_boot',
    location: 'server.js:prepare',
    message: 'next_prepare_done',
    data: { cwd: process.cwd(), dirname: __dirname, argv0: process.argv[0] },
  })
  // #endregion

  // #region agent log
  console.log('[dbg H3] hasGetUpgradeHandler:', typeof app.getUpgradeHandler === 'function')
  // #endregion

  const server = createServer((req, res) => {
    const parsed = parse(req.url, true)
    // #region agent log — dev-only dump (paste JSON for Cursor agent if workspace files do not sync)
    if (dev && parsed.pathname === '/api/__b9_debug_dump') {
      res.statusCode = 200
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(
        JSON.stringify({
          sessionId: 'b9a7e7',
          count: B9_RING.length,
          lines: B9_RING,
        })
      )
      return
    }
    // #endregion
    handle(req, res, parsed)
  })

  const wss = new WebSocket.Server({ noServer: true })

  // #region agent log - H3: get Next.js upgrade handler for HMR
  let nextUpgradeHandler = null
  if (typeof app.getUpgradeHandler === 'function') {
    nextUpgradeHandler = await app.getUpgradeHandler()
    console.log('[dbg H3] nextUpgradeHandler acquired:', typeof nextUpgradeHandler)
  }
  // #endregion

  // #region agent log — first HMR upgrade only (avoid log spam)
  let hmrForwardLogged = false
  // #endregion

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url, true)

    // #region agent log
    console.log('[dbg H1] upgrade:', pathname)
    // #endregion

    if (pathname !== '/api/deepgram/proxy') {
      // H1 fix: forward non-proxy upgrades to Next.js (HMR) instead of destroying
      if (nextUpgradeHandler) {
        if (!hmrForwardLogged && pathname.includes('webpack-hmr')) {
          hmrForwardLogged = true
          dbgFile({
            hypothesisId: 'H_hmr',
            location: 'server.js:upgrade',
            message: 'hmr_forward_first',
            data: { pathname },
          })
        }
        nextUpgradeHandler(req, socket, head)
      } else {
        dbgFile({
          hypothesisId: 'H_hmr',
          location: 'server.js:upgrade',
          message: 'hmr_no_next_handler_destroy',
          data: { pathname },
        })
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

      // Confirmed fix: raw API key → 401. Must use a grantToken JWT for usage:write scope.
      let wsToken = apiKey
      try {
        const dgClient = createDgClient(apiKey)
        const { result, error } = await dgClient.auth.grantToken()
        if (!error && result?.access_token) {
          wsToken = result.access_token
          // #region agent log
          console.log('[dbg fix] using grantToken JWT for upstream auth')
          dbgFile({
            hypothesisId: 'H_jwt_upstream',
            location: 'server.js:proxy',
            message: 'grantToken_ok',
            data: { upstreamAuth: 'jwt' },
          })
          // #endregion
        } else {
          // #region agent log
          console.warn('[dbg fix] grantToken failed, falling back to raw key:', error)
          dbgFile({
            hypothesisId: 'H_jwt_upstream',
            location: 'server.js:proxy',
            message: 'grantToken_fail',
            data: { upstreamAuth: 'raw_fallback', err: error ? String(error).slice(0, 200) : null },
          })
          // #endregion
        }
      } catch (e) {
        // #region agent log
        console.warn('[dbg fix] grantToken threw:', e.message)
        dbgFile({
          hypothesisId: 'H_jwt_upstream',
          location: 'server.js:proxy',
          message: 'grantToken_throw',
          data: { upstreamAuth: 'raw_fallback', err: e.message },
        })
        // #endregion
      }

      const dgUrl = buildDeepgramListenUrl(req.url)
      // #region agent log
      console.log('[dbg 400] full upstream URL:', dgUrl)
      // #endregion
      console.log('[deepgram proxy] opening upstream:', dgUrl.replace(/\?.*/, '?...'))

      const dgWs = new WebSocket(dgUrl, {
        headers: { Authorization: `Token ${wsToken}` },
      })

      dgWs.on('open', () => {
        console.log('[deepgram proxy] upstream connected')
        // #region agent log
        dbgFile({
          hypothesisId: 'H_dg_open',
          location: 'server.js:dgWs',
          message: 'upstream_ws_open',
          data: {},
        })
        // #endregion
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
        dbgFile({
          hypothesisId: 'H_dg_err',
          location: 'server.js:dgWs',
          message: 'upstream_ws_error',
          data: { err: err.message.slice(0, 300) },
        })
        cleanup()
      })
      // #region agent log - capture Deepgram's actual rejection body (400 diagnosis)
      dgWs.on('unexpected-response', (_req, res) => {
        let body = ''
        res.on('data', chunk => { body += chunk })
        res.on('end', () => {
          console.error('[dbg 400] Deepgram rejection:', res.statusCode, body)
          dbgFile({
            hypothesisId: 'H_dg_reject',
            location: 'server.js:unexpected-response',
            message: 'upstream_rejected',
            data: { status: res.statusCode, body: body.slice(0, 500) },
          })
          browserWs.close(1011, 'upstream rejected')
        })
      })
      // #endregion
      browserWs.on('close', cleanup)
      browserWs.on('error', (err) => {
        console.error('[deepgram proxy] browser error:', err.message)
        cleanup()
      })
    })
  })

  server.on('error', (err) => {
    // #region agent log
    dbgFile({
      hypothesisId: 'H_listen',
      location: 'server.js:server.on(error)',
      message: 'server_listen_error',
      data: { code: err.code, port },
    })
    // #endregion
    if (err.code === 'EADDRINUSE') {
      console.error(
        `[server] Port ${port} is already in use. Stop the other dev server (Ctrl+C) or run: Get-NetTCPConnection -LocalPort ${port} | % { Stop-Process -Id $_.OwningProcess -Force }`
      )
    }
  })

  server.listen(port, () => {
    // #region agent log
    dbgFile({
      hypothesisId: 'H_listen',
      location: 'server.js:listen',
      message: 'server_listening',
      data: { port, hostname },
    })
    // #endregion
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
