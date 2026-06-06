export interface WorldTier {
  id: string
  label: string
  minWpm: number
  color: string
}

export const WORLD_TIERS: WorldTier[] = [
  { id: 'ground', label: 'Ground', minWpm: 0, color: '#22c55e' },
  { id: 'sky', label: 'Sky', minWpm: 70, color: '#3b82f6' },
  { id: 'space', label: 'Space', minWpm: 100, color: '#f97316' },
  { id: 'heaven', label: 'Heaven', minWpm: 130, color: '#eab308' },
  { id: 'mythic', label: 'Mythic', minWpm: 170, color: '#a855f7' },
]

export function getTierForWpm(wpm: number): WorldTier {
  let tier = WORLD_TIERS[0]!
  for (const t of WORLD_TIERS) {
    if (wpm >= t.minWpm) tier = t
  }
  return tier
}

/** Normalised 0–1 position along the full tier track for a given WPM. */
export function wpmToTrackProgress(wpm: number): number {
  const maxWpm = 200
  return Math.min(1, Math.max(0, wpm / maxWpm))
}

/** Continuous scroll offset (px) driven by live WPM — climbs through atmosphere. */
export function wpmToScrollOffset(wpm: number): number {
  return wpm * 2.5
}
