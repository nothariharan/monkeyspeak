# MonkeySpeak — Product Requirements Document

**Version:** 1.0  
**Status:** Draft  
**Stack:** Next.js 14 · TypeScript · Tailwind CSS · Deepgram SDK · Framer Motion

---

## 1. Overview

MonkeySpeak is a minimalist voice benchmarking tool that measures how fast and accurately a person can speak. It is the spoken equivalent of MonkeyType — same philosophy, same aesthetic rigour, applied to voice.

Two things are being measured, depending on mode:

- **Speed Mode** — how many words per minute you can articulate out loud, captured live via microphone through Deepgram's real-time streaming STT.
- **Clarity Mode** — how accurately your voice-to-text tool of choice (Wispr Flow, Apple Dictation, Windows Voice Typing, etc.) transcribes a given prompt. No microphone required on our end. User speaks into their own tool, output lands in our text field, we diff it.

---

## 2. Design Philosophy

MonkeySpeak inherits MonkeyType's core UX ethos:

- Everything on a single page. No nav clutter.
- The test is the UI. Nothing competes with it.
- Colour is feedback, not decoration.
- Micro-interactions communicate state, never shout it.
- Dark by default. Light mode available.
- Monospace font throughout (`JetBrains Mono` or `Fira Code`).
- All controls are keyboard accessible.

The palette is minimal: near-black background, muted grey for untyped/unspoken text, white/cream for active text, a single accent colour (yellow or coral — configurable in themes) for correct output, red for errors, a subtle purple flash for filler word detection.

---

## 3. Core Modes

### 3.1 Speed Mode

The user speaks into their microphone. Deepgram streams transcription back word by word in real time. WPM is calculated live. Filler words are stripped before counting. The test ends when the timer hits zero.

**What is measured:**
- Words per minute (net, after filler removal)
- Filler words detected and removed
- Speaking consistency (WPM variance across the session)
- Words matched against prompt (optional — see prompt sub-modes)

**Timer options:** 15s · 30s · 60s · 120s  
**Prompt sub-modes:** fixed prompt · random sentences · numbers · custom paste

### 3.2 Clarity Mode

The user is shown a prompt. They activate their own STT tool (Wispr Flow, dictation, etc.) and speak the prompt. When done, they click stop. The transcribed output that landed in the text field is diffed word-by-word against the original prompt.

**What is measured:**
- **Clarity Score** — percentage of prompt words correctly transcribed
- Word-level diff: correct / substituted / missed / added
- No timer pressure. This is accuracy only.

**Clarity Score formula:**
```
Clarity Score = (correct words / total prompt words) × 100
```

Displayed as a percentage with a letter grade:
- 98–100% → S
- 90–97%  → A
- 75–89%  → B
- 60–74%  → C
- below 60% → needs work

---

## 4. Page Layout

### 4.1 Header (minimal, always visible)

```
monkeyspeak                    [speed] [clarity]     [theme] [settings]
```

- Logo: lowercase monospace, left-aligned
- Mode switcher: two pill tabs, centre or right
- Theme + settings icons: far right, icon only
- No other navigation

### 4.2 Config Bar (below header, above test area)

Visible before test starts, hides on start, reappears on reset.

**Speed Mode config bar:**
```
[15s]  [30s]  [60s]  [120s]     |     [sentences]  [numbers]  [custom]
```

**Clarity Mode config bar:**
```
[sentences]  [technical]  [tongue twisters]  [custom]
```

Config options are pill buttons, single-select per group. Active state uses accent colour. Inactive uses muted grey.

### 4.3 Test Area (centre stage)

This is the dominant element. 60–70% of viewport height. Nothing else matters while a test is running.

**Speed Mode — test area anatomy:**
- Prompt text rendered word by word, greyed out initially
- As speech is recognised, words highlight:
  - `muted` → unspoken
  - `accent` → correctly spoken and matched
  - `red` → recognised but mismatched
  - `cursor pulse` → current word expected
- Live transcript ghost text appears below the prompt in smaller, italic type — showing raw Deepgram output as it streams in
- Filler word flash (see §6 Micro-interactions) triggers on detection

**Clarity Mode — test area anatomy:**
- Prompt displayed at top, full opacity
- Large editable text area below with placeholder: `activate your voice tool and speak the prompt...`
- On stop, text area locks and diff rendering replaces it inline

### 4.4 Stats Bar

Sits above or below the test area. Updates live during Speed Mode. Static summary in Clarity Mode.

**Speed Mode (live):**
```
wpm: 143    words: 47    fillers: 3    time: 00:23
```

**Clarity Mode (post-test):**
```
clarity: 94%    correct: 47    missed: 2    added: 1    grade: A
```

### 4.5 Results Panel

Appears below the test area after completion. Slides up with a subtle ease-in. Does not replace the test area — appends below it so the user can still see their output.

**Speed Mode results:**
```
143 wpm

words spoken    fillers removed    peak wpm    consistency
    51               4               167          87%

[retry]   [next test]   [share]
```

**Clarity Mode results:**
```
clarity score: 94%   grade: A

[diff view rendered inline — correct in accent, wrong in red, missed struck through]

[retry same prompt]   [new prompt]   [share]
```

---

## 5. Prompt System

### 5.1 Sentence Bank
Curated sentences across three difficulty levels:

- **Casual** — everyday conversational language, short-medium sentences
- **Technical** — product/engineering vocabulary, compound sentences
- **Tongue Twisters** — phonetically complex, tests articulation under pressure

### 5.2 Numbers Mode (Speed only)
Numbers read aloud — "forty seven", "two hundred and twelve". Tests a different speech pattern, useful for finance/ops users.

### 5.3 Custom Mode
User pastes any text. Used for practising specific scripts, presentations, pitches.

### 5.4 Prompt Length Scaling
Prompt length auto-scales to the selected timer duration. 15s gets ~30–40 words. 120s gets ~250 words. Prompts never run out mid-test.

---

## 6. Micro-interactions & Visual Feedback

These are the soul of the product. All animations use Framer Motion. All durations are under 300ms unless specified. Nothing bounces. Nothing slides dramatically. Everything is subtle.

### 6.1 Filler Word Detection Flash
When Deepgram returns a filler word ("um", "uh", "er", "like", "you know", "basically", "literally", "right", "so", "actually"):

- The entire test area background does a single rapid pulse: `transparent → rgba(139, 92, 246, 0.08) → transparent` over 400ms
- A small pill appears briefly at the top right of the test area: `+1 filler` fades in and out over 600ms
- The filler word never appears in the prompt highlight — it is silently consumed
- If 3+ fillers are detected in a 10-second window, the pulse colour shifts warmer (amber) — a gentle visual nudge

### 6.2 Word Correct Flash
Each correctly matched word:
- Transitions from muted grey to accent colour
- Subtle scale: `1.0 → 1.02 → 1.0` over 150ms
- No bounce. Just a soft confirm.

### 6.3 Word Miss
When a spoken word clearly mismatches the expected prompt word:
- Word turns red
- Slight horizontal shake: `0 → -2px → 2px → 0` over 200ms

### 6.4 Timer Warning
When 5 seconds remain in Speed Mode:
- Timer text transitions to red
- Cursor pulse on current word speeds up slightly
- No sound (no audio feedback in v1)

### 6.5 Test Start
When the user hits start / microphone activates:
- Config bar fades out upward (opacity 1→0, translateY 0→-8px, 200ms)
- Stats bar fades in
- Prompt text brightens slightly
- Cursor begins pulsing on first word

### 6.6 Test End
- All animations stop
- Prompt area dims slightly
- Results panel slides up from below (translateY 20px→0, opacity 0→1, 300ms ease-out)

### 6.7 Mic Inactive / Permission Denied
- A single pulsing dot in the stats area (red, 1s pulse loop)
- Tooltip on hover: "microphone access needed"
- No modal. No alert. Just the dot.

### 6.8 Clarity Mode Diff Reveal
After the user stops their Clarity Mode session:
- Text area content morphs word by word into the diff view
- Each word flips to its colour class with a staggered delay of 30ms per word
- Feels like the system is reading and judging in real time

---

## 7. Deepgram Integration (Speed Mode)

### 7.1 Connection Flow
1. User clicks start
2. Browser requests microphone permission
3. On grant: open WebSocket to Deepgram Live Transcription API
4. Stream raw PCM audio from `getUserMedia`
5. Receive `transcript` events, extract `words[]` array with timestamps
6. Filter filler words client-side (Deepgram's `disfluencies` param as backup)
7. Update WPM counter every 500ms using elapsed time and confirmed word count
8. On timer end: close WebSocket, freeze stats, render results

### 7.2 Deepgram Config
```json
{
  "model": "nova-2",
  "language": "en-US",
  "smart_format": true,
  "disfluencies": true,
  "interim_results": true,
  "utterance_end_ms": 1000,
  "vad_events": true
}
```

### 7.3 WPM Calculation
```
net_words = total_confirmed_words - filler_words_detected
elapsed_minutes = elapsed_ms / 60000
wpm = Math.round(net_words / elapsed_minutes)
```

WPM is only displayed after 3 seconds of speech to avoid inflated numbers from a standing start.

### 7.4 Consistency Score
Calculated as inverse of WPM standard deviation across 5-second windows:
```
consistency = 100 - (std_dev / mean_wpm × 100)
```
Capped at 100. Shown in results only, not live.

### 7.5 API Key Handling
Deepgram API key must never be exposed client-side. All WebSocket connections are proxied through a Next.js API route (`/api/deepgram/token`) that issues short-lived temporary tokens. The real key lives in environment variables server-side only.

---

## 8. Clarity Mode — Diff Engine

### 8.1 Input
- `prompt`: original prompt string
- `transcript`: whatever text was in the input field when user clicked stop

### 8.2 Normalisation
Both strings are lowercased, punctuation stripped, whitespace normalised before diffing.

### 8.3 Diff Algorithm
Levenshtein-based word-level diff. Each word tagged as:
- `correct` — exact match
- `substituted` — wrong word in right position
- `missed` — prompt word absent in transcript
- `added` — extra word in transcript not in prompt

### 8.4 Display
```
The [quick] [brown] [fox] [jumps] [over] the [lazy] [dog]
     ✓       ✓       ✓     ✓       ✗           ✓      ✓
                                 (said "runs")      (missed "the")
```
Colour classes: correct=accent, substituted=red, missed=strikethrough muted, added=orange underline.

---

## 9. Settings & Personalisation

Accessible via the settings icon. Stored in `localStorage`. No account required in v1.

| Setting | Options | Default |
|---|---|---|
| Theme | dark / light / system | dark |
| Accent colour | yellow / coral / blue / green | yellow |
| Font | JetBrains Mono / Fira Code / Inconsolata | JetBrains Mono |
| Font size | small / medium / large | medium |
| Filler flash | on / off | on |
| Show live transcript | on / off | on |
| Smooth caret | on / off | on |
| Language | en-US / en-GB / en-AU | en-US |

---

## 10. Themes

Two base themes, same structure as MonkeyType:

**Dark (default)**
- Background: `#0d0d0d`
- Unspoken text: `#3a3a3a`
- Active/spoken text: `#e2e2e2`
- Accent: `#e8c96a` (yellow) or user-selected
- Error: `#ca4754`
- Filler flash: `rgba(139, 92, 246, 0.08)`
- Stats: `#888888`

**Light**
- Background: `#f5f5f0`
- Unspoken text: `#c0c0b8`
- Active text: `#1a1a1a`
- Accent: same family, slightly desaturated
- Error: `#d94f4f`

---

## 11. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Tab` | Reset / new test |
| `Enter` | Start test (when mic ready) |
| `Escape` | Stop test early |
| `Ctrl + ,` | Open settings |
| `Ctrl + 1/2` | Switch Speed / Clarity mode |

---

## 12. Sharing & Results

Post-test, a share card can be generated (no account needed):

```
monkeyspeak
─────────────────────────
143 wpm  ·  94% consistency
4 fillers removed
15 seconds  ·  sentence mode
─────────────────────────
monkeyspeak.app
```

Share as image (canvas-rendered PNG) or copy as text. No social login. No tracking.

---

## 13. Technical Architecture

```
/app
  /page.tsx                  — main test page
  /api
    /deepgram/token/route.ts — issues temporary Deepgram tokens
/components
  /TestArea.tsx              — prompt display + word highlighting
  /StatsBar.tsx              — live wpm / words / fillers / timer
  /ConfigBar.tsx             — mode, duration, prompt type selectors
  /ResultsPanel.tsx          — post-test results + share
  /ClarityInput.tsx          — clarity mode text area + diff view
  /FillerFlash.tsx           — filler detection overlay animation
  /MicButton.tsx             — start/stop with mic state
/hooks
  /useDeepgram.ts            — WebSocket connection, streaming, word events
  /useTimer.ts               — countdown with interval
  /useWpm.ts                 — word count, filler filter, wpm calc
  /useDiff.ts                — clarity mode diff engine
/lib
  /fillers.ts                — filler word list
  /prompts.ts                — sentence bank by difficulty
  /diff.ts                   — levenshtein word diff
/store
  /testStore.ts              — Zustand store for test state
```

**Dependencies:**
- `@deepgram/sdk` — Deepgram client
- `framer-motion` — all animations
- `zustand` — lightweight state management
- `tailwindcss` — styling
- `next` 14 with App Router

---

## 14. v1 Scope (what ships first)

- Speed Mode with Deepgram, all 4 timer options, sentence + random prompts
- Clarity Mode with paste-in transcript and diff engine
- Filler flash animation
- Dark theme only
- Settings (font, accent, filler flash toggle)
- Share card as image
- Mobile-responsive layout (test works on mobile, mic access permitting)

## 15. v2 Scope (post-launch)

- Leaderboard (anonymous, keyed by session token)
- Historical personal bests stored in localStorage
- Typing mode (MonkeyType-style, for comparison)
- Additional languages
- Light theme
- API benchmark mode — compare Deepgram vs Web Speech vs AssemblyAI head to head on the same prompt
- Streaks and practice history

---

*End of PRD v1.0*