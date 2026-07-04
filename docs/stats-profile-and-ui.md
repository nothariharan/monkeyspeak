# stats dashboard, profile hub, and ui consistency

## overview

local analytics + speaker profile without touching the core speed test loop. secondary pages now match the homepage minimal desk style — soft borders, pill buttons, lowercase type — instead of thick brutalist outlines

## new routes and surfaces

### `/stats`

local-only dashboard. data from `sessionHistory` and `lifetimeStats` in zustand (persisted to localStorage)

| section | what it shows |
|---------|----------------|
| summary metrics | total runs, avg wpm, max wpm, avg accuracy |
| wpm trend | line chart of net wpm across speed runs |
| consistency curve | line chart when consistency scores exist |
| weekly fillers | bar chart of avg fillers per session by week |
| missed words | top five words the stt pipeline missed most |

charts are inline svg — no chart library. empty states use the same dashed placeholder as the homepage preflight hint

### profile hub (header drawer)

opened from the user icon in the header:

- mascot tier from personal-best wpm
- lifetime stats grid (runs, speaking time, words, fillers, accuracy, streak)
- github-style activity heatmap (24 weeks)
- achievement grid with unlock states

### error boundaries

- `app/error.tsx` — recoverable runtime errors with retry + home link
- `app/not-found.tsx` — friendly 404

## achievements

defined in `lib/achievements.ts`, evaluated after each session save in the store:

| id | unlock condition |
|----|------------------|
| first_words | complete 1 session |
| howler_monkey | 100+ wpm speed run |
| silverback | 150+ wpm speed run |
| zen_chimp | 30s+ speed run with 0 fillers |
| yap_master | complete a 120s speed session |
| clarity_s | 98%+ accuracy in clarity mode |
| twister_master | tongue twister run at 85%+ accuracy |
| chatterbox | 2000+ lifetime words spoken |

## shared css

desk-style tokens live in `app/globals.css`:

- `.stats-card`, `.stats-metric`, `.stats-section-title`
- `.profile-drawer`, `.achievement-badge`
- reused on home results panel, settings, stats, error pages

## files to touch

| area | start here |
|------|------------|
| stats page | `app/stats/page.tsx` |
| profile drawer | `components/ProfileHub.tsx` |
| achievement logic | `lib/achievements.ts` |
| streak | `lib/stats/streak.ts` |
| store persistence | `store/testStore.ts` |
