const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const {
  verifySessionGrant,
  buildDeepgramListenUrl,
  MAX_BUFFERED_FRAMES,
} = require('../lib/security/sessionGrantCompat.cjs');

// env load order — repo root .env.local first (same file next.js uses)
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 8080;

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,https://monkeyspeak-delta.vercel.app')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function corsOrigin(origin, cb) {
  if (!origin || ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
    return cb(null, true);
  }
  return cb(null, false);
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-MS-Session');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST', 'OPTIONS'],
}));
app.use(express.json());

const tokenHits = new Map();
function tokenRateOk(ip) {
  const now = Date.now();
  const last = tokenHits.get(ip) ?? 0;
  if (now - last < 8_000) return false;
  tokenHits.set(ip, now);
  return true;
}

// short-lived deepgram key — requires a monkeyspeak session grant
app.post('/api/deepgram/token', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()
    || req.socket.remoteAddress
    || 'unknown';
  if (!tokenRateOk(ip)) {
    return res.status(429).json({ error: 'slow down — too many token requests' });
  }

  const session = req.headers['x-ms-session'] || req.query.session || req.body?.session;
  const sessionCheck = verifySessionGrant(session, 'deepgram');
  if (!sessionCheck.ok) {
    return res.status(401).json({ error: sessionCheck.error });
  }

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

app.get('/api/deepgram/token', (_req, res) => {
  res.status(405).json({ error: 'use POST with X-MS-Session' });
});

// render / coolify health checks hit this
app.get('/', (req, res) => {
  res.send('MonkeySpeak Backend is running');
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

const proxyHits = new Map();
function proxyRateOk(ip) {
  const now = Date.now();
  const entry = proxyHits.get(ip);
  if (!entry || now > entry.resetAt) {
    proxyHits.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count += 1;
  return true;
}

server.on('upgrade', (req, socket, head) => {
  const isListen = req.url.startsWith('/v1/listen') || req.url.startsWith('/api/deepgram/proxy');
  if (!isListen) {
    socket.destroy();
    return;
  }

  const incoming = new URL(req.url, 'http://127.0.0.1');
  const session = incoming.searchParams.get('session') || req.headers['x-ms-session'];
  const sessionCheck = verifySessionGrant(session, 'deepgram');
  if (!sessionCheck.ok) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()
    || req.socket.remoteAddress
    || 'unknown';
  if (!proxyRateOk(ip)) {
    socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
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

    const bufferedMessages = [];
    let isDgOpen = false;

    browserWs.on('message', (data) => {
      if (isDgOpen && dgWs.readyState === WebSocket.OPEN) {
        dgWs.send(data);
      } else if (bufferedMessages.length < MAX_BUFFERED_FRAMES) {
        bufferedMessages.push(data);
      } else {
        browserWs.close(1008, 'buffer overflow');
        dgWs.close();
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
