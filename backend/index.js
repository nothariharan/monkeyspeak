const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');

// Load env from repo root first (.env.local is where Next keeps DEEPGRAM_API_KEY),
// then backend-local .env — same keys are not overwritten (dotenv default).
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 8080;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
}));
app.use(express.json());

// Issue a short-lived Deepgram temporary API token
app.get('/api/deepgram/token', async (req, res) => {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  const projectId = process.env.DEEPGRAM_PROJECT_ID;

  if (!apiKey) {
    return res.status(500).json({ error: 'DEEPGRAM_API_KEY not configured' });
  }

  if (!projectId) {
    return res.json({ key: apiKey });
  }

  try {
    const response = await fetch(
      `https://api.deepgram.com/v1/projects/${projectId}/keys`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: 'monkeyspeak-ephemeral',
          scopes: ['usage:write'],
          time_to_live_in_seconds: 30,
        }),
      }
    );

    if (!response.ok) {
      return res.json({ key: apiKey });
    }

    const data = await response.json();
    return res.json({ key: data.result?.key ?? apiKey });
  } catch {
    return res.json({ key: apiKey });
  }
});

// Health check endpoint for GCP
app.get('/', (req, res) => {
  res.send('MonkeySpeak Backend is running');
});

// ── WebSocket proxy ───────────────────────────────────────────────────────────
// Browser connects here; backend forwards to Deepgram using server-side auth.
// The browser never needs to send credentials — Node.js sets Authorization as
// a proper HTTP header which the browser WebSocket API forbids.

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

/**
 * Merge browser query params into a Deepgram /v1/listen URL.
 * Maps `lang` → `language` (browser cannot use custom headers; we only pass lang).
 */
function buildDeepgramListenUrl(browserReqUrl) {
  const incoming = new URL(browserReqUrl, 'http://127.0.0.1');
  const p = incoming.searchParams;

  if (p.has('lang') && !p.has('language')) {
    p.set('language', p.get('lang'));
    p.delete('lang');
  }

  const defaults = {
    model: 'nova-3',
    language: 'en-US',
    encoding: 'linear16',
    sample_rate: '16000',
    channels: '1',
    smart_format: 'false',
    interim_results: 'true',
    endpointing: '10',
    no_delay: 'true',
    filler_words: 'true',
    utterance_end_ms: '1000',
  };
  for (const [k, v] of Object.entries(defaults)) {
    if (!p.has(k)) p.set(k, v);
  }
  // Forward any additional client-supplied Deepgram params (utterance_end_ms, etc.)
  // All unrecognised params are passed through as-is to allow experimentation.

  return `wss://api.deepgram.com/v1/listen?${p.toString()}`;
}

server.on('upgrade', (req, socket, head) => {
  // Accept /v1/listen (SDK-built path) and /api/deepgram/proxy (plain browser WS)
  const isListen = req.url.startsWith('/v1/listen') || req.url.startsWith('/api/deepgram/proxy');
  if (!isListen) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (browserWs) => {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      browserWs.close(1011, 'DEEPGRAM_API_KEY not configured');
      return;
    }

    const dgUrl = buildDeepgramListenUrl(req.url);
    if (process.env.DEBUG_DG_PROXY === '1') {
      console.log('[deepgram proxy] upstream:', dgUrl);
    }

    const dgWs = new WebSocket(dgUrl, {
      headers: { Authorization: `Token ${apiKey}` },
    });

    // Buffer any audio packets sent before the Deepgram connection is fully open
    const bufferedMessages = [];
    let isDgOpen = false;

    browserWs.on('message', (data) => {
      if (isDgOpen && dgWs.readyState === WebSocket.OPEN) {
        dgWs.send(data);
      } else {
        bufferedMessages.push(data);
      }
    });

    dgWs.on('open', () => {
      isDgOpen = true;
      // Flush any buffered audio frames
      while (bufferedMessages.length > 0) {
        const msg = bufferedMessages.shift();
        if (dgWs.readyState === WebSocket.OPEN) {
          dgWs.send(msg);
        }
      }
    });

    // Forward transcripts from Deepgram to browser
    dgWs.on('message', (data) => {
      if (browserWs.readyState === WebSocket.OPEN) browserWs.send(data);
    });

    function cleanup() {
      if (dgWs.readyState < WebSocket.CLOSING) dgWs.close();
      if (browserWs.readyState < WebSocket.CLOSING) browserWs.close();
    }

    dgWs.on('close', cleanup);
    dgWs.on('error', (err) => {
      console.error('[dg→proxy] WS error:', err.message);
      cleanup();
    });

    dgWs.on('unexpected-response', (_req, res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        console.error('[deepgram proxy] upstream rejected:', res.statusCode, body.slice(0, 500));
        if (browserWs.readyState < WebSocket.CLOSING) {
          browserWs.close(1011, 'upstream rejected');
        }
      });
    });

    browserWs.on('close', cleanup);
    browserWs.on('error', (err) => { console.error('[browser→proxy] WS error:', err.message); cleanup(); });
  });
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
