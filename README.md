# monkeyspeak

what's launching: a tiny speaking benchmark. read prompts out loud, get a wpm score, chase one more personal best 🙊
(totally original idea hehehe)

check out [CONTRIBUTING.md](CONTRIBUTING.md) for the longer contributor guide — this readme is the fast version.

![monkeyspeak banner](./public/banner.png)

monkeyspeak is basically monkeytype but you use your voice. pick a prompt, hit start talking, and the app tracks how fast you spoke, what it actually heard, and whether too many ums snuck in while you were cooking.

works out of the box with browser speech recognition. no api key, no signup, just mic access and mild embarrassment when you misread the prompt.

## screenshots

| screen | preview |
| --- | --- |
| idle / home | ![idle](./docs/screenshots/idle.png) |
| live test | ![live test](./docs/screenshots/live-test.png) |
| results | ![results](./docs/screenshots/results.png) |

![monkey mascot](./public/sprites/120+/tile2.png)

## what it does (non-exhaustive)

**speed mode**
- 15s / 30s / 60s / 120s timed runs
- live net wpm (fillers like um and uh get stripped)
- words dissolve off the screen as the app hears them correctly
- passage end mode + sentence difficulty tiers
- session graph with per-word timing windows
- personal bests per duration + prompt type (local)

**clarity mode**
- paste a transcript, get a word diff against the prompt
- letter grades from s down to needs work
- practice mode rebuilds a prompt from words you missed

**leaderboard + social**
- home page leaderboard panel — duration tabs synced with config bar, crown for top spots, your row pinned at the bottom
- global leaderboard via supabase — nickname + emoji after a run, no signup
- top score card shows your personal best for the current duration, not whoever is #1 globally

**stats + profile** (`/stats`)
- streak, totals, recent runs, wpm trend charts
- achievement grid (first words, silverback, clarity s, etc)
- profile hub drawer — nickname, activity, badges
- all local except the global board

**ui + polish**
- minimal desk-style layout shared across home, stats, results, settings
- monkey mascot reacts to speaking momentum (gsap sprites)
- themes, accent colors, fonts, blind mode, transcript toggles
- daily challenge card, branded og image, monkey favicon

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
| brave / edge | `wss://monkeyspeak.onrender.com/api/deepgram/proxy` |
| chrome / firefox | same-origin `POST /api/deepgram/live` on vercel |
| localhost | local ws proxy on `:8080` when backend is running |

health checks go through `/api/deepgram/proxy-health` on vercel so the browser never does a cross-origin fetch at the render url (chrome yelled about cors for weeks).

### global leaderboard (optional)

scores are shared across everyone via supabase postgres. no accounts — just a nickname and emoji after a speed run.

1. create a [Supabase](https://supabase.com) project
2. run the migration in [supabase/migrations/001_leaderboard_entries.sql](supabase/migrations/001_leaderboard_entries.sql)
3. add to `.env.local`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

without those vars the app still runs; the board just shows a friendly error until you wire it up.

writes go through `POST /api/leaderboard` with the service role key. same name + board + higher wpm updates your row, lower wpm gets ignored.

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
  supabase/         migration sql for leaderboard_entries
  store/            zustand state + persisted settings
  public/           sprites, onnx model, audio workers, mascots
  backend/          standalone deepgram websocket proxy (render)
  server.js         prod next + proxy in one node process
  docs/             dev notes and screenshots
  patches/          patch-package fixes
```

touching the live speaking experience? start in [app/page.tsx](app/page.tsx), [components/game/SpeakingGame.tsx](components/game/SpeakingGame.tsx), and [hooks/](hooks).

touching scoring? [lib/alignTranscriptToPrompt.ts](lib/alignTranscriptToPrompt.ts), [lib/fillers.ts](lib/fillers.ts), [lib/stats/](lib/stats), [lib/diff.ts](lib/diff.ts).

touching the board? [app/api/leaderboard/route.ts](app/api/leaderboard/route.ts), [components/decor/HeroLeaderboard.tsx](components/decor/HeroLeaderboard.tsx).

touching stats/achievements? [app/stats/page.tsx](app/stats/page.tsx), [lib/achievements.ts](lib/achievements.ts), [lib/stats/streak.ts](lib/stats/streak.ts).

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

## docs

- [docs/theme-hydration.md](docs/theme-hydration.md) — why theme boot avoids inline styles on `<html>`
- [docs/stats-profile-and-ui.md](docs/stats-profile-and-ui.md) — stats page and profile hub notes

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
