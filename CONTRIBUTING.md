# Contributing to MonkeySpeak

Thanks for poking around. MonkeySpeak is small enough to hack on without a ceremony, but speech apps have a special talent for being fine on one machine and weird on another, so here is the practical setup.

## Get local

```bash
git clone https://github.com/nothariharan/monkeyspeak.git
cd monkeyspeak
npm install
npm run dev
```

Open `http://localhost:3000`, allow the mic, and run a short speed test before changing anything. It gives you a baseline, and it also catches browser permission weirdness early.

## Pick your speech provider

Most UI and scoring work can use browser speech:

```bash
npm run dev
```

If you are touching Deepgram behavior, run the proxy too:

```bash
npm run dev:backend
```

Then add this to `.env.local`:

```env
DEEPGRAM_API_KEY=your_deepgram_api_key_here
DEEPGRAM_PROJECT_ID=your_deepgram_project_id_here
NEXT_PUBLIC_DEEPGRAM_PROXY_URL=ws://localhost:8080/api/deepgram/proxy
```

For the global leaderboard locally, also add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — see [.env.example](.env.example).

## Where to start

| If you are changing... | Start here |
| --- | --- |
| Main app flow | `app/page.tsx` |
| Test UI and game surface | `components/game/SpeakingGame.tsx` |
| Browser speech | `hooks/useWebSpeech.ts` |
| Deepgram speech | `hooks/useDeepgramProvider.ts`, `lib/deepgramConnection.ts`, `backend/index.js` |
| Prompt generation | `lib/prompts.ts`, `lib/wordLists.ts` |
| WPM and consistency | `lib/stats/` |
| Word matching and scoring | `lib/alignTranscriptToPrompt.ts`, `lib/diff.ts`, `lib/fillers.ts` |
| Result cards | `components/ResultsPanel.tsx`, `lib/shareCard.ts` |
| Themes and styling | `lib/themes.ts`, `app/globals.css`, `tailwind.config.js` |

## The "did I break it?" checklist

Before sending a PR, please run:

```bash
npm run lint
npm run build
```

Then do a quick manual pass:

- Start a `15s` browser speech speed test.
- Confirm the timer moves and words dissolve.
- Stop early with `Escape`.
- Finish one run and check that WPM, accuracy, and retry still work.
- If you touched Deepgram, test with `npm run dev:backend` and the Deepgram provider selected.

## A few house rules

- Keep API keys in `.env.local`. Never commit secrets.
- Keep changes focused. A scoring fix should not also redesign the settings panel unless the two are actually linked.
- Prefer small, readable helpers over clever one-liners. Future-you deserves mercy.
- If you add a screenshot, put it in `docs/screenshots/` and link it from the README or the relevant doc.
- If a browser behaves differently, mention which one. Chrome, Brave, Edge, and Safari do not always agree about speech APIs.

## Deploy notes

The default production server is:

```bash
npm run build
npm start
```

That path uses `server.js`, which runs the Next.js app and integrated Deepgram proxy together.

For split deploys, the standalone proxy lives in `backend/`. Its Render notes are in [backend/README.md](backend/README.md).
