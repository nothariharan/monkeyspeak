# Results Screen Redesign (Speed mode)

This document describes the redesign of the speed-test results screen and the
supporting data-model changes.

## Why

The previous results screen rendered two large side-by-side text boxes
("prompt review" + "recognized"). It read like a debug dump: visually heavy,
hard to scan, and it forced the user to compare two blocks to understand a
single run. The redesign makes the headline metric the hero, surfaces a quick
at-a-glance breakdown, and moves the verbose word-by-word comparison behind an
on-demand "detailed breakdown" toggle.

## What changed

### UI ([`components/ResultsPanel.tsx`](../components/ResultsPanel.tsx))

Speed mode is now a single, centered column (`max-w-[680px]`):

1. **Hero** - large WPM number with a GSAP count-up, a `wpm` label, a delta line
   (`▲ +N from last run` / `▼ N from last run` / `even with last run` /
   `first run`), and a "new personal best" pill (or `best N wpm` when not a PB).
2. **Stat cards** - four compact bordered cards: accuracy, raw wpm, words spoken,
   fillers. They fade-up in a stagger on mount.
3. **Breakdown** - an animated accuracy bar that fills to the accuracy
   percentage, with `X% correct` and `correct / total words` labels and a
   `correct / wrong / missed` legend with counts.
4. **Detailed breakdown (on demand)** - a toggle that reveals two stacked views:
   - **expected** - the prompt rendered with diff coloring (correct / wrong /
     missed); hovering a wrong word shows what was said vs expected.
   - **you said (transcribed)** - the raw spoken transcript (fillers stripped).
   The diff words cascade in (and wrong words shake) when the section opens.
5. **Actions** - retry / next test / practice missed / share, plus keyboard hints.

Clarity-mode results are unchanged.

### Styling ([`app/globals.css`](../app/globals.css))

Added `.result-card` (bordered stat card) and `.accuracy-track` /
`.accuracy-fill` (the breakdown bar). All colors use existing theme tokens
(`--accent`, `--text-muted`, `--text-stats`, `--bg-surface`) so the screen
follows the active theme.

## Data-model changes

### [`store/testStore.ts`](../store/testStore.ts)

`SpeedResults` gained two fields:

- `transcript: string` - the raw spoken transcript (fillers stripped) used by the
  "you said" detailed view.
- `deltaWpm: number | null` - net WPM change vs the previous speed run; `null`
  when there is no prior run (shown as "first run").

`Settings` gained:

- `lastSpeedWpm?: number` - net WPM of the most recent speed run, persisted so the
  next run can show a delta. Covered by the existing settings persistence/merge.

### [`app/page.tsx`](../app/page.tsx)

`finalizeSpeed` now:

- stores the full transcript on the results object,
- computes `deltaWpm` against `settings.lastSpeedWpm` (or `null` on the first run),
- persists the new `lastSpeedWpm` via `updateSettings`.

The WPM / accuracy / diff computation (Smith-Waterman alignment in
[`lib/alignTranscriptToPrompt.ts`](../lib/alignTranscriptToPrompt.ts)) is
unchanged.

## Animations (GSAP)

- WPM count-up: `gsap.to(obj, { val: netWpm, duration: 1.2, ease: 'power2.out' })`.
- Stat cards: `gsap.from('.stat-card', { y: 24, opacity: 0, stagger: 0.07 })`.
- Accuracy bar: `gsap.fromTo('.accuracy-fill', { width: '0%' }, { width: '<acc>%' })`.
- Detailed diff: words cascade (`y: 6`, stagger) and substituted words shake,
  triggered when the toggle opens.
