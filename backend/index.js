const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');

// env load order matters: repo root .env.local first (same file next.js uses),
// then fallbacks. dotenv won't stomp keys that are already set.
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

// short-lived deepgram key for clients that can't hold the real api key
app.get('/api/deepgram/token', async (req, res) => {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  const projectId = process.env.DEEPGRAM_PROJECT_ID;

  if (!apiKey) {
    return res.status(500).json({ error: 'DEEPGRAM_API_KEY not configured' });
  }

  if (!projectId) {
    return res.status(503).json({
      error: 'DEEPGRAM_PROJECT_ID not configured. cannot issue ephemeral token',
    });
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
      console.warn('[deepgram/token] ephemeral key creation failed:', response.status);
      return res.status(503).json({
        error: 'Unable to issue Deepgram token. Try again later.',
      });
    }

    const data = await response.json();
    const ephemeralKey = data.result?.key;

    if (!ephemeralKey) {
      return res.status(503).json({
        error: 'Unable to issue Deepgram token. Try again later.',
      });
    }

    return res.json({ key: ephemeralKey });
  } catch (err) {
    console.warn('[deepgram/token] ephemeral key creation threw:', err?.message ?? err);
    return res.status(503).json({
      error: 'Unable to issue Deepgram token. Try again later.',
    });
  }
});

// render / coolify health checks hit this
app.get('/', (req, res) => {
  res.send('MonkeySpeak Backend is running');
});

// websocket proxy
// browser connects here because it literally cannot set Authorization on a ws.
// we attach the deepgram token server-side and pipe audio both ways.

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

// turn the browser query string into a deepgram /v1/listen url.
// maps lang -> language since the client only gets query params, not headers.
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
    // deepgram rejects live ws below 1000ms with a 400. learned that the hard way.
    utterance_end_ms: '1000',
  };
  for (const [k, v] of Object.entries(defaults)) {
    if (!p.has(k)) p.set(k, v);
  }
  // anything else on the query string passes through for experiments

  return `wss://api.deepgram.com/v1/listen?${p.toString()}`;
}

server.on('upgrade', (req, socket, head) => {
  // sdk builds /v1/listen, plain browser ws uses /api/deepgram/proxy
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

    // mic might start sending pcm before deepgram finishes handshaking.
    // buffer those frames instead of dropping them on the floor.
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
      while (bufferedMessages.length > 0) {
        const msg = bufferedMessages.shift();
        if (dgWs.readyState === WebSocket.OPEN) {
          dgWs.send(msg);
        }
      }
    });

    // deepgram sometimes sends json as binary frames. normalize to utf-8 text
    // so the browser client can JSON.parse without blob gymnastics.
    dgWs.on('message', (data) => {
      if (browserWs.readyState !== WebSocket.OPEN) return;
      const text = typeof data === 'string' ? data : data.toString('utf8');
      browserWs.send(text);
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
