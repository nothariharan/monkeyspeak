# Stats dashboard, profile hub, and UI consistency

## Overview

This release adds local analytics and a speaker profile without changing the core
speed test loop. It also aligns secondary pages with the homepage's minimal desk
style — soft borders, pill buttons, lowercase display type — instead of the older
brutalist cards (thick black outlines and hard offset shadows).

## New routes and surfaces

### `/stats`

Local-only analytics dashboard. Data comes from `sessionHistory` and
`lifetimeStats` in the Zustand store (persisted to `localStorage`).

| Section | What it shows |
|---------|----------------|
| Summary metrics | Total runs, average WPM, max WPM, average accuracy |
| WPM trend | Line chart of net WPM across speed runs (oldest → newest) |
| Consistency curve | Line chart when consistency scores exist |
| Weekly fillers | Bar chart of average filler words per session by week |
| Missed words | Top five words the STT pipeline most often missed |

Charts are lightweight inline SVG — no chart library dependency. Empty states use
the same dashed placeholder treatment as the homepage preflight hint.

### Profile hub (header drawer)

Opened from the user icon in the header. Shows:

- Mascot tier based on personal-best WPM
- Lifetime stats grid (runs, speaking time, words, fillers, accuracy, streak)
- GitHub-style activity heatmap (24 weeks)
- Achievement grid with unlock states

### Error boundaries

- `app/error.tsx` — recoverable runtime errors with retry + home link
- `app/not-found.tsx` — friendly 404 for unknown routes

### SEO / sharing

- `app/robots.ts`, `app/sitemap.ts` — crawl hints
- `app/opengraph-image.tsx` — dynamic OG image for link previews

## Supporting modules

| Path | Purpose |
|------|---------|
| `lib/achievements.ts` | Badge definitions and unlock evaluation |
| `lib/stats/streak.ts` | Speaking streak calculation |
| `lib/__tests__/*.test.ts` | Unit tests for achievements, streak, WPM, consistency |
| `public/mascot_*.png` | Tier mascots for profile / monkey display |

## Styling conventions

Shared classes live in `app/globals.css`:

- `stats-card`, `stats-metric`, `stats-empty`, `stats-chip` — stats page
- `stats-page-title`, `stats-page-subtitle` — page headings
- `profile-drawer`, `achievement-card` — profile hub
- Existing desk primitives: `desk-btn`, `note-panel`, `paper-panel`, `stat-label`, `stat-value`

When adding new pages, prefer these classes over inline `boxShadow: '4px 4px 0 …'`
patterns.

## Store changes

`store/testStore.ts` now tracks:

- `sessionHistory` entries with WPM, accuracy, fillers, missed words, consistency
- `lifetimeStats` aggregates
- `speakingActivity` heatmap counts
- `unlockedAchievements` IDs

Achievements emit a `monkeyspeak:badge-unlocked` window event; the homepage listens
and shows a collect-sticker modal.

## Testing

```bash
npm test
```

Covers achievement rules, streak math, WPM helpers, and consistency scoring.

## Future documentation (reserved)

<!-- Space intentionally left for later sections: -->

<!-- - API / leaderboard integration notes -->
<!-- - Achievement catalog with unlock criteria table -->
<!-- - Analytics privacy model (local-only vs cloud) -->
<!-- - Chart data schema for sessionHistory entries -->
<!-- - Mascot tier thresholds -->
<!-- - Mobile layout breakpoints for /stats -->
<!-- - Screenshot gallery for marketing / README -->
