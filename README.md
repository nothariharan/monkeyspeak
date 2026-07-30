# monkeyspeak

a tiny speaking benchmark. read prompts out loud, get a wpm score, chase one more personal best 🙊
(totally original idea hehehe)

check out [CONTRIBUTING.md](CONTRIBUTING.md) for the longer contributor guide — this readme is the fast version.

![monkeyspeak banner](./public/banner.png)

monkeyspeak is basically monkeytype but you use your voice. pick a prompt, hit start talking, and the app tracks how fast you spoke, what it actually heard, and whether too many ums snuck in while you were cooking.

works out of the box with browser speech recognition. no api key, no signup, just mic access and mild embarrassment when you misread the prompt.

![monkey mascot](./public/sprites/120+/tile2.png)

## what it does (non-exhaustive)

**speed mode**
- 15s / 30s / 60s / 120s timed runs
- live net wpm (fillers like um and uh get stripped)
- words dissolve off the screen as the app hears them correctly
- passage end mode + sentence difficulty tiers
- session graph with per-word timing windows
- personal bests per duration + prompt type (local)

**clarity mode (stt tool benchmark)**
- pick a transcription tool (wispr, chatgpt voice, apple, deepgram, chrome, or custom)
- read a precision prompt, paste that tool's transcript, get word + punctuation scores
- letter grades from s down to needs work
- shared tool leaderboard via supabase (rolling 30-day averages)
- practice mode rebuilds a prompt from words you missed

**ghost race**
- race a visual ghost that replays the pace of your saved speed personal best
- needs at least one speed pb first (new bests store a timeline for the ghost)
- same mic + duration controls as speed mode

**leaderboard + social**
- home page shows a top-5 preview with a link to the full board
- `/leaderboard` has the full rankings (filters + scroll) plus your local stats/charts
- global speed leaderboard via supabase — nickname + emoji after a run, no signup
- clarity mode has its own per-tool board (separate from speed)
- top score card shows your personal best for the current duration, not whoever is #1 globally
- `/stats` redirects to `/leaderboard#stats`

**profile**
- achievement grid (first words, silverback, clarity s, etc)
- profile hub drawer — nickname, activity, badges
- personal bests and trends stay local; the board is the only shared piece

**ui + polish**
- desk / doodle hero (slanted sticky notes, paper tape, monkey mascot)
- themes, accent colors, fonts, blind mode
- daily goal + quick tips on the home page
- branded og image, monkey favicon

**speech (stt)**
- browser web speech api by default — no key needed
- optional deepgram for better live transcription in production
- brave/edge route through render websocket proxy; chrome/firefox use vercel http bridge (see [production](#production))

## get it running

you need node 20+ and a microphone. that's it for the default path.

```bash
git clone https://github.com/nothariharan/monkeyspeak.git
cd monkeyspeak
npm install
npm run dev
```

point your browser at http://localhost:3000, allow the mic, and try not to read like you are defusing a bomb.

sip some water. you're about to yapppppity yapppp

### browser speech (start here)

this is the easy path. try this first.

```bash
npm run dev
```

chrome is usually the smoothest. brave and edge work for browser mode but shields can block google's speech service — if you want deepgram on brave, see below.

### deepgram

deepgram gives you better live transcription and matches the production-style setup.

copy the env template:

```bash
cp .env.example .env.local
```

fill in `.env.local`:

```env
DEEPGRAM_API_KEY=your_deepgram_api_key_here
DEEPGRAM_PROJECT_ID=your_deepgram_project_id_here
NEXT_PUBLIC_DEEPGRAM_PROXY_URL=ws://localhost:8080/api/deepgram/proxy
```

boot both in two terminals:

```bash
# terminal 1
npm run dev

# terminal 2
npm run dev:backend
```

open settings, flip stt provider to deepgram, and you should be good.

the deepgram api key stays on the server. the browser talks to your proxy or the vercel bridge, not straight to deepgram with the permanent key taped to the client.

**browser routing in prod**

| browser | deepgram path |
| --- | --- |
| all (when proxy is up) | `wss://monkeyspeak.onrender.com/api/deepgram/proxy` |
| fallback | same-origin `POST /api/deepgram/live` on vercel |
| localhost | local ws proxy on `:8080` when backend is running |

the vercel http bridge is fallback-only — duplex request streaming to serverless hangs, which used to show up as a client “connection timed out” error. health checks go through `/api/deepgram/proxy-health` on vercel so the browser never does a cross-origin fetch at the render url.

**troubleshooting: voice wave moves but no words**

the speaking wave is driven by local mic energy. it can look “alive” even when deepgram never returns `Results`. usual causes:

1. **render proxy cold / unreachable** — `/api/deepgram/proxy-health` fails and the app falls back to `POST /api/deepgram/live` on vercel. that bridge often opens without useful transcripts. proxy-health now retries with a longer timeout so free-tier cold starts can wake up; the client also retries the probe once before falling back.
2. **stale “listening” session** — if deepgram claimed to connect but produced no words, the 5s failsafe used to no-op. it now force-reconnects.
3. **local setup** — run both `npm run dev` and `npm run dev:backend`, and set `NEXT_PUBLIC_DEEPGRAM_PROXY_URL=ws://localhost:8080/api/deepgram/proxy` in `.env.local`.

debug: set `NEXT_PUBLIC_DEBUG_STT=true`, then check the network tab for a websocket to the render/local proxy (preferred) vs a long `/api/deepgram/live` post (fragile fallback).

### global leaderboard (optional)

scores are shared across everyone via supabase postgres. no accounts — just a nickname and emoji after a speed run.

1. create a [Supabase](https://supabase.com) project
2. run the migrations in order:
   - [supabase/migrations/001_leaderboard_entries.sql](supabase/migrations/001_leaderboard_entries.sql) — speed board
   - [supabase/migrations/002_clarity_benchmark.sql](supabase/migrations/002_clarity_benchmark.sql) — clarity tool board
3. add to `.env.local`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

without those vars the app still runs; the boards just stay empty / show a friendly message until you wire them up.

speed writes go through `POST /api/leaderboard` with the service role key. same name + board + higher wpm updates your row, lower wpm gets ignored.

clarity writes go through `POST /api/clarity-benchmark` after you score a paste-in transcript.

## scripts

```bash
npm run dev              # next dev server
npm run dev:backend      # deepgram websocket proxy on port 8080
npm run dev:turbo        # next with turbopack
npm run dev:clean        # clear .next cache then dev
npm run build            # production build
npm start                # prod server + integrated proxy (server.js)
npm run lint             # eslint — do this before a pr
npm test                 # jest unit tests (scoring, streak, achievements)
```

## keyboard shortcuts

- `Enter` — start a test, or next prompt after a run
- `Tab` — reset, stop, or retry depending on where you are
- `Escape` — bail on a running test early
- `Ctrl + ,` — open settings
- `Ctrl + 1` / `Ctrl + 2` — speed mode / clarity mode
- ghost race is in the header tabs (same controls as speed once you have a pb)

## where stuff lives

```text
monkeyspeak/
  app/              pages and api routes (leaderboard, deepgram, proxy health)
  app/stats/        stats dashboard
  components/       ui, controls, results, profile hub, hero leaderboard
  components/game/  speaking test world, hud, graph, monkey
  hooks/            timer, speech providers, vad, leaderboard fetch
  lib/              prompts, scoring, diff, themes, achievements, streak
  lib/supabase/     server-only supabase admin client
  lib/stats/        wpm, timeline, personal bests, consistency
  supabase/         migration sql (speed + clarity boards)
  store/            zustand state + persisted settings
  public/           sprites, onnx model, audio workers, mascots, ghost-race art
  backend/          standalone deepgram websocket proxy (render)
  server.js         prod next + proxy in one node process
  patches/          patch-package fixes
```

touching the live speaking experience? start in [app/page.tsx](app/page.tsx), [components/game/SpeakingGame.tsx](components/game/SpeakingGame.tsx), and [hooks/](hooks).

touching ghost race? [components/game/GhostRace.tsx](components/game/GhostRace.tsx), [lib/stats/timeline.ts](lib/stats/timeline.ts), and the `ghost` mode bits in [store/testStore.ts](store/testStore.ts).

touching scoring? [lib/alignTranscriptToPrompt.ts](lib/alignTranscriptToPrompt.ts), [lib/fillers.ts](lib/fillers.ts), [lib/stats/](lib/stats), [lib/diff.ts](lib/diff.ts).

touching the speed board? [app/api/leaderboard/route.ts](app/api/leaderboard/route.ts), [app/leaderboard/page.tsx](app/leaderboard/page.tsx), [components/decor/HeroLeaderboard.tsx](components/decor/HeroLeaderboard.tsx).

touching the clarity board? [app/api/clarity-benchmark/route.ts](app/api/clarity-benchmark/route.ts), [lib/clarityLeaderboard/](lib/clarityLeaderboard), [components/ClarityInput.tsx](components/ClarityInput.tsx).

touching stats/achievements? [app/leaderboard/page.tsx](app/leaderboard/page.tsx) (`#stats`), [lib/achievements.ts](lib/achievements.ts), [lib/stats/streak.ts](lib/stats/streak.ts).

## env vars (when you care)

| variable | notes |
| --- | --- |
| `DEEPGRAM_API_KEY` | server side only, never expose in client code |
| `DEEPGRAM_PROJECT_ID` | used for short-lived token creation |
| `NEXT_PUBLIC_DEEPGRAM_PROXY_URL` | browser websocket url. local: `ws://localhost:8080/api/deepgram/proxy`. prod: `wss://monkeyspeak.onrender.com/api/deepgram/proxy` |
| `SUPABASE_URL` | supabase project url for global leaderboard (server only) |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key for leaderboard api routes |
| `DEEPGRAM_SECONDS_PER_IP` | optional daily deepgram budget per ip (default 300s) |
| `DEEPGRAM_SECONDS_GLOBAL` | optional global daily deepgram budget (default 3600s) |
| `PORT` | optional. defaults to 3000 for the app, 8080 for backend |
| `NEXT_PUBLIC_DEBUG_STT` | set to `true` for stt debug logs in the browser console |
| `DEBUG_DG_PROXY` | set to `1` for noisy proxy logs on render |

full copy-paste template lives in [.env.example](.env.example).

## production

live site: [monkeyspeak-delta.vercel.app](https://monkeyspeak-delta.vercel.app)

split deploy (what we run today):

| piece | host | job |
| --- | --- | --- |
| frontend + api routes | vercel | next app, leaderboard, deepgram http bridge, proxy health |
| websocket proxy | [render](https://monkeyspeak.onrender.com) | deepgram audio proxy for brave/edge |

on vercel set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEEPGRAM_API_KEY`, `DEEPGRAM_PROJECT_ID`, and `NEXT_PUBLIC_DEEPGRAM_PROXY_URL=wss://monkeyspeak.onrender.com/api/deepgram/proxy`. render only needs the deepgram keys.

single-service option still works locally or on one node:

```bash
npm run build
npm start
```

`npm start` runs [server.js](server.js), which serves next and the deepgram proxy from the same process.

want render setup notes? see [backend/README.md](backend/README.md).

## before you open a pr

skim [CONTRIBUTING.md](CONTRIBUTING.md), then:

```bash
npm run lint
npm run build
npm test
```

also do one real speaking run in the browser. speech bugs love looking fine in typescript and then falling apart the second a microphone joins the party.

## license

mit. see [LICENSE](LICENSE).

![monkey mascot](./public/sprites/120+/tile2.png)
