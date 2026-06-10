# MonkeySpeak Deepgram WebSocket proxy

Small Express + `ws` server that proxies browser WebSocket connections to Deepgram live listen. Required for **Brave** and **Edge**, which block direct cross-origin WebSocket to `api.deepgram.com`.

## Deploy on Render

1. Create a **Web Service** from this repo.
2. Set **Root Directory** to `backend`.
3. **Build command:** `npm install`
4. **Start command:** `npm start`
5. Add environment variables (Dashboard → Environment):
   - `DEEPGRAM_API_KEY` — your Deepgram API key
   - `DEEPGRAM_PROJECT_ID` — project UUID (for token endpoint)
   - `PORT` — Render sets this automatically; default is `8080` locally

6. After deploy, copy the public URL (e.g. `https://monkeyspeak-dg-proxy.onrender.com`).

## Connect the frontend (Vercel)

In Vercel project settings → Environment Variables (Production + Preview):

```
NEXT_PUBLIC_DEEPGRAM_PROXY_URL=wss://YOUR-SERVICE.onrender.com/api/deepgram/proxy
```

Redeploy the Next.js app so the client bundle picks up the new URL.

## Health check

```bash
curl https://YOUR-SERVICE.onrender.com/
```

Should return a plain text OK response.

## Local dev

From repo root:

```bash
npm run dev:backend
```

Then in `.env.local`:

```
NEXT_PUBLIC_DEEPGRAM_PROXY_URL=ws://localhost:8080/api/deepgram/proxy
```

Run `npm run dev` in another terminal.
