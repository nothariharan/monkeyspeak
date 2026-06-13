# MonkeySpeak Deepgram proxy

This folder is the standalone WebSocket proxy for Deepgram live transcription.

Why it exists: browsers cannot reliably attach the auth headers Deepgram needs for a direct live WebSocket connection. Brave and Edge are especially picky here, so the browser talks to this proxy and the proxy talks to Deepgram with the server-side API key.

## Local dev

From the repo root:

```bash
npm run dev:backend
```

Then put this in `.env.local` for the frontend:

```env
NEXT_PUBLIC_DEEPGRAM_PROXY_URL=ws://localhost:8080/api/deepgram/proxy
```

Run the frontend in another terminal:

```bash
npm run dev
```

Open the app, go to settings, and choose `Deepgram` as the STT provider.

## Required env

| Variable | Notes |
| --- | --- |
| `DEEPGRAM_API_KEY` | Permanent server-side Deepgram API key. Keep it out of client code. |
| `DEEPGRAM_PROJECT_ID` | Used by the token endpoint for short-lived key creation. |
| `PORT` | Optional locally. Defaults to `8080`; Render sets this for you. |
| `DEBUG_DG_PROXY` | Optional. Set to `1` when you want noisy proxy logs. |

## Deploy on Render

1. Create a Render **Web Service** from this repo.
2. Set **Root Directory** to `backend`.
3. Use `npm install` as the build command.
4. Use `npm start` as the start command.
5. Add `DEEPGRAM_API_KEY` and `DEEPGRAM_PROJECT_ID` in the Render environment tab.
6. Deploy, then copy the public service URL.

The frontend needs the WebSocket URL, not the plain site URL:

```env
NEXT_PUBLIC_DEEPGRAM_PROXY_URL=wss://YOUR-SERVICE.onrender.com/api/deepgram/proxy
```

Add that to Vercel or wherever the Next.js app is deployed, then redeploy the frontend so the client bundle picks it up.

## Health check

```bash
curl https://YOUR-SERVICE.onrender.com/
```

You should get a small OK response. If that works but live speech does not, turn on `DEBUG_DG_PROXY=1` and check the proxy logs while starting a test.
