import type { PersonalBestEntry } from '@/store/testStore'

/** highest cached wpm across every saved speed run key */
export function getHighestPersonalBestWpm(
  bests: Record<string, PersonalBestEntry>
): number {
  let top = 0
  for (const entry of Object.values(bests)) {
    if (entry.wpm > top) top = entry.wpm
  }
  return top
}
