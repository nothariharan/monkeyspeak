# MonkeySpeak — Improvement Roadmap

**Status:** Proposal / research draft
**Author:** Engineering review
**Scope:** Product, UX, engineering, and infra advancements for the next phases
**Live site:** https://monkeyspeak-delta.vercel.app

---

## 1. Purpose

This document is a researched, prioritized plan for evolving MonkeySpeak beyond its
current v1. It is grounded in an audit of the actual codebase (not aspirational
wishlisting): every recommendation names the files it touches and states the effort
and impact. The goal is to turn MonkeySpeak from "a polished single-session toy" into
a **sticky, shareable, multi-session speaking benchmark** with a defensible technical
core.

The original vision lives in [`msprd.md`](../msprd.md). Several v2 items from that PRD
are already shipped (leaderboard, localStorage personal bests, light theme, streaks).
This roadmap picks up from the *current* state of `main`.

---

## 2. Where we are today (audit snapshot)

**Shipped and solid**
- Speed Mode (15/30/60/120s), passage-end mode, difficulty tiers, numbers, custom, daily challenge
- Clarity Mode with word-level diff + letter grades
- Live scoring: Smith–Waterman alignment (`lib/dpAlign.ts`) + Double Metaphone phonetic match (`lib/wordMatch.ts`)
- Dual STT: browser Web Speech (`hooks/useWebSpeech.ts`) + Deepgram (`hooks/useDeepgramProvider.ts`) with proxy/bridge routing
- Global leaderboard on Supabase (`app/api/leaderboard/route.ts`), no-signup nickname+emoji
- Local stats: streaks, lifetime aggregates, trend charts, 8 achievements (`lib/achievements.ts`)
- Theming system, accent colors, fonts, blind mode (`lib/themes.ts`, `store/testStore.ts`)
- GSAP monkey mascot reacting to momentum, session graph
- PNG share card via canvas (`lib/shareCard.ts`)

**Notable gaps found during audit**
| Gap | Evidence | Section |
|---|---|---|
| Share card is hardcoded dark theme + wrong footer domain (`monkeyspeak.app`) | `lib/shareCard.ts:39-42,112` | §5.1 |
| No native Web Share / no per-score dynamic OG image | `components/ResultsPanel.tsx` only downloads PNG | §5.1, §5.2 |
| No PWA / installability / offline | no `manifest`, no service worker | §7.1 |
| English-only (en-US/GB/AU) despite global framing | `hooks/useWebSpeech.ts:254` | §6.2 |
| Leaderboard trivially spoofable (client posts its own WPM) | `app/api/leaderboard/route.ts` validates ranges only | §8.2 |
| Only 8 achievements, no levels/XP progression loop | `lib/achievements.ts` | §4.1 |
| No account / cross-device sync (all local) | `store/testStore.ts` persist to localStorage | §8.1 |
| "Typing mode for comparison" (PRD v2) never built | no `typing` refs in code | §4.3 |
| Test coverage is scoring-only; no component/e2e tests | `lib/__tests__/*` only | §9.2 |
| No product analytics / error monitoring | no analytics deps | §9.3 |

---

## 3. Prioritization framework

Each item is tagged:
- **Impact**: 🔴 high · 🟠 medium · 🟢 nice-to-have
- **Effort**: S (≤1 day) · M (2–4 days) · L (1–2 weeks) · XL (>2 weeks)
- **Type**: Retention · Virality · Accuracy · Reach · Infra · Health

A phased sequencing is in §11.

---

## 4. Product depth — modes, content & gamification

### 4.1 Progression system: levels, XP, and a richer badge set 🔴 · M · Retention
Today there are 8 boolean achievements (`lib/achievements.ts`) and personal bests, but
no *continuous* progression to pull users back. The mascot tiers (sleepy → fire) already
imply a leveling metaphor — formalize it.

- Introduce **XP** earned per run (scaled by WPM, accuracy, duration, streak bonus) and a
  **speaker level** with a visible bar. Persist in `Settings.lifetimeStats`.
- Expand achievements to ~25 with tiered variants (bronze/silver/gold WPM milestones,
  "7-day streak", "spoke 10k words", "sub-2% filler run", "all four durations in a day").
- Add **near-miss nudges** ("12 WPM from Silverback") on the results screen and profile hub.
- Implementation: extend `evaluateAchievements()` signature (already receives lifetime +
  entry), add an `xp` field to `lifetimeStats`, render in `ProfileHub` and `PersonalStatsSection`.

### 4.2 Weekly & seasonal challenges 🟠 · M · Retention
The daily challenge (seeded by date) is a proven hook — extend it.
- **Weekly leaderboard reset** with a dedicated board (`promptType: weekly-YYYY-WW`), so
  new players can top a board without beating all-time legends.
- **Themed weeks** (tongue-twister week, numbers week) surfaced on the hero.
- Reuses the existing daily seeding pattern in `lib/prompts.ts` + leaderboard board keys.

### 4.3 "Typing mode" head-to-head + benchmark mode 🟢 · L · Reach
PRD v2 called for a MonkeyType-style typing comparison and an STT engine benchmark
(Deepgram vs Web Speech vs AssemblyAI on the same prompt). This is a strong differentiator
and content/SEO magnet ("is talking faster than typing?").
- Ship **benchmark mode** first (smaller): run one prompt through both configured STT
  providers and show a side-by-side accuracy/latency diff. Infra already supports both providers.
- Typing mode is a larger build; defer unless it maps to a marketing goal.

### 4.4 Content library & custom prompt packs 🟠 · S–M · Retention
- Add curated **prompt packs** (interview answers, TED-style, sci passages, famous speeches)
  layered on the existing `PromptType` union and `lib/prompts.ts` / `lib/wordLists.ts`.
- Let users **save custom prompts** (a small local library) instead of re-pasting; store in settings.

### 4.5 Practice intelligence 🟠 · M · Accuracy/Retention
`generatePracticePrompt` already rebuilds prompts from missed words. Level it up:
- Track a **per-word weakness model** across sessions (frequency of miss/substitution) —
  data already collected in `SessionHistoryEntry.missedWords`.
- Surface a "your tricky words" drill and weight practice prompts toward them.

---

## 5. Virality & sharing

### 5.1 Fix + upgrade the share card 🔴 · S · Virality/Health
`lib/shareCard.ts` hardcodes the old dark palette (`#0d0d0d`, `#e8c96a`) and prints a
footer domain (`monkeyspeak.app`) that isn't the live site. Two problems: it ignores the
user's active theme, and it points nowhere.
- Read the live theme tokens (CSS custom properties) so the card matches what the user sees.
- Fix the footer to the real URL.
- Add the mascot tier art + streak + accuracy for a more "flex-worthy" card.

### 5.2 Native Web Share + dynamic OG images 🔴 · M · Virality
- Wire `navigator.share()` (with the PNG blob) alongside the download fallback in
  `ResultsPanel.handleShare` — one tap to share on mobile.
- Generate a **per-result OG image** via a Next.js route (`@vercel/og` / `next/og`) so a
  shared score link unfurls with the actual WPM on Twitter/Discord/iMessage. This is the
  single highest-leverage growth feature; every shared run becomes an ad.

### 5.3 Challenge-a-friend links 🟠 · M · Virality
- Encode `{duration, promptType, seed}` into a URL so a friend takes the *exact same prompt*
  and the result screen shows "you vs. them". Seeding already exists for daily challenges.

---

## 6. Reach — accessibility, i18n, mobile

### 6.1 Accessibility pass 🟠 · M · Reach/Health
Coverage is partial (~31 `aria-label` usages). Do a focused audit:
- Focus trapping + restore on all modals/drawers (`SettingsPanel`, `ProfileHub`,
  `LeaderboardSavePrompt`, badge modal — badge modal a11y was just added).
- Live-region announcements for WPM/timer during a run (screen-reader users can't see the HUD).
- Verify color contrast across every theme (accent-on-surface especially).
- Respect `prefers-reduced-motion` everywhere GSAP/Framer animate.

### 6.2 Multi-language speaking 🟠 · L · Reach
Currently English-only despite "global" framing. Deepgram + Web Speech both support many
languages. Add Spanish/French/German/Hindi prompt banks and wire `Settings.language` through
`lib/prompts.ts`. Big TAM expansion; needs localized prompt content (the real cost).

### 6.3 Mobile-first polish 🟠 · M · Reach
Mic UX and the hero/leaderboard grid need dedicated mobile QA (iOS Safari `getUserMedia`
quirks, the hero title overflow class we just tightened). Add haptics on run start/end and
a bottom-sheet results layout.

---

## 7. Performance & platform

### 7.1 Make it an installable PWA 🟠 · M · Retention/Reach
No manifest or service worker today. Add `app/manifest.ts`, icons (already have
`app/icon.png`/`apple-icon.png`), and an offline shell so browser-speech runs work offline
and users can install to home screen. Speaking apps benefit hugely from home-screen presence.

### 7.2 Bundle & load audit 🟢 · S · Health
GSAP + Framer Motion + onnxruntime-web (VAD) + Deepgram SDK is heavy. Audit with
`@next/bundle-analyzer`; lazy-load the ONNX VAD (`skipVad` defaults true anyway) and the
Deepgram path so first paint stays lean. Consider dropping Framer *or* GSAP (both animate).

### 7.3 Core Web Vitals + font strategy 🟢 · S · Health
Self-host the mono fonts with `next/font` and verify no layout shift from the hero mascot
and ambient background image (`public/hero-ambient-bg.png`).

---

## 8. Data, accounts & integrity

### 8.1 Optional accounts + cloud sync 🟠 · L · Retention/Infra
Everything is localStorage (`store/testStore.ts`), so history dies with the browser and
can't cross devices. Add **optional, no-friction auth** (Supabase Auth is already in the
stack; magic-link or "Sign in with Vercel") that, when present, syncs settings/history/PBs.
Keep anonymous local play as the default — never gate the core loop.

### 8.2 Leaderboard anti-cheat 🔴 · M · Infra/Health
The client posts its own `wpm`/`accuracy`; validation only checks ranges (`route.ts`).
A determined user can submit any score ≤250. Harden without killing the no-signup vibe:
- Submit a signed **run token** issued at test start + basic server-side plausibility checks
  (elapsed time vs word count vs WPM must be internally consistent).
- Add per-name/day caps and shadow-flag statistical outliers for a "verified" badge tier.
- Rate limit is in-memory (`lib/deepgramRateLimit.ts` pattern) — move to a durable store
  (Upstash Redis via Vercel Marketplace) so it survives across serverless instances.

### 8.3 Friends / following 🟢 · L · Retention
Once accounts exist, a lightweight follow graph + friends-only leaderboard is a natural
retention multiplier. Sequence after §8.1.

---

## 9. Engineering health

### 9.1 Fix known correctness/UX debt 🟠 · S · Health
Recently addressed in review (charts clamping, weekly-filler ordering, badge-modal a11y,
hero-title overflow, `/stats` permanent redirect, leaderboard cap message). Continue the
sweep: dead-code hygiene (several unused decor components were removed), and re-verify the
share-card issues in §5.1.

### 9.2 Test coverage beyond scoring 🟠 · M · Health
Tests today cover only pure scoring libs (`lib/__tests__/`). Add:
- Component tests (React Testing Library) for `ResultsPanel`, `LeaderboardSavePrompt`, config flows.
- A Playwright e2e that mocks the mic/STT stream and runs a full speed session end-to-end
  (the README itself warns speech bugs "look fine in TypeScript then fall apart with a mic").

### 9.3 Product analytics + error monitoring 🔴 · S · Health/Infra
There is no visibility into real usage or client errors. Add privacy-friendly analytics
(Vercel Analytics is one integration away) and Sentry for client/STT errors. Without this
we're guessing at what to build next — this should land early to inform the rest of the roadmap.

### 9.4 STT resilience 🟠 · M · Accuracy/Health
The Deepgram path has bridge/proxy/browser-routing complexity (see README table) and a
5s runtime failsafe in `app/page.tsx`. Add structured telemetry on fallback events, a
clearer in-UI "why did it switch?" explanation, and consider evaluating a third provider
(AssemblyAI/Groq Whisper) behind the existing provider abstraction (`useActiveSpeechProvider`).

---

## 10. Design & UX enhancements

- **Results storytelling** 🟠 S: the session graph is rich but dense — add a one-line
  auto-generated "insight" ("you started strong then faded after 40s") from the timeline data
  already in `SpeedResults.timeline`.
- **Onboarding** 🟠 S: a 15-second first-run coach-mark flow (mic permission, how scoring
  works) to cut bounce on the very first session.
- **Sound design** 🟢 S: optional subtle audio feedback on filler detection / new PB
  (PRD explicitly deferred audio to v1 — now's the time), gated behind a setting.
- **Empty states** 🟢 S: the stats page is graceful when empty; extend the same care to a
  brand-new leaderboard board and a zero-history profile.

---

## 11. Suggested sequencing

**Phase 1 — Instrument & harvest virality (fast, high leverage)**
1. Analytics + error monitoring (§9.3) — *know what's happening first*
2. Fix + theme the share card (§5.1)
3. Native Web Share + dynamic OG images (§5.2)
4. Leaderboard anti-cheat basics + durable rate limit (§8.2)

**Phase 2 — Retention loop**
5. XP/levels + expanded achievements (§4.1)
6. Weekly challenges & rotating boards (§4.2)
7. PWA/installable (§7.1)
8. Practice-intelligence weakness model (§4.5)

**Phase 3 — Reach & platform**
9. Optional accounts + cloud sync (§8.1)
10. Accessibility pass (§6.1) + Playwright e2e (§9.2)
11. Challenge-a-friend links (§5.3)
12. Multi-language (§6.2)

**Phase 4 — Differentiators**
13. STT benchmark mode (§4.3)
14. Friends graph (§8.3)
15. Typing-vs-speaking comparison (§4.3)

---

## 12. Quick wins (do-this-week candidates)

- Fix share-card theme + footer URL (§5.1) — **S**
- Add Vercel Analytics + Sentry (§9.3) — **S**
- Results-screen auto-insight line (§10) — **S**
- `app/manifest.ts` + installability metadata (§7.1 first step) — **S**
- Expand achievements from 8 → ~20 (data plumbing already exists) (§4.1) — **S/M**

---

## 13. Open questions for product

1. Is the north-star **retention** (daily habit) or **virality** (shared scores)? Phase order
   assumes "instrument first, then virality, then retention."
2. Are we willing to introduce *optional* accounts, or is no-signup a hard brand principle?
   This gates §8.1 / §8.3.
3. What's the appetite for non-English content investment (§6.2 is mostly a content cost)?
4. Do we keep both GSAP and Framer Motion long-term, or consolidate (§7.2)?

---

*This roadmap is grounded in the state of `main` at the time of writing. Re-validate file
references before implementation — the codebase moves.*
