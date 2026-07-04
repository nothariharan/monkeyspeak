import type { SessionHistoryEntry } from '@/store/testStore'

export interface Achievement {
  id: string
  title: string
  description: string
  iconType: string
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_words', title: 'First Words', description: 'Complete 1 speaking session', iconType: 'mic' },
  { id: 'howler_monkey', title: 'Howler Monkey', description: 'Hit 100+ WPM in Speed Mode', iconType: 'speed' },
  { id: 'silverback', title: 'Silverback Gorilla', description: 'Hit 150+ WPM in Speed Mode', iconType: 'fire' },
  { id: 'zen_chimp', title: 'Zen Chimpanzee', description: 'Complete a run (>= 30s) with 0 fillers', iconType: 'zen' },
  { id: 'yap_master', title: 'Yap Master', description: 'Complete a 120s Speed session', iconType: 'clock' },
  { id: 'clarity_s', title: 'Clarity Scholar', description: 'Get an S grade (>= 98%) in Clarity Mode', iconType: 'star' },
  { id: 'twister_master', title: 'Twister Master', description: 'Complete a tongue twister run with >= 85% accuracy', iconType: 'tongue' },
  { id: 'chatterbox', title: 'Chatterbox', description: 'Speak 2,000+ total lifetime words', iconType: 'chat' },
]

export function evaluateAchievements(
  currentUnlocked: string[],
  lifetime: { totalRuns: number; totalWords: number; totalSeconds: number; totalFillers: number },
  newEntry: SessionHistoryEntry
): string[] {
  const newUnlocked: string[] = [...currentUnlocked]

  const unlock = (id: string) => {
    if (!newUnlocked.includes(id)) {
      newUnlocked.push(id)
    }
  }

  // 1. first_words
  if (lifetime.totalRuns >= 1) {
    unlock('first_words')
  }

  // 2. howler_monkey
  if (newEntry.mode === 'speed' && newEntry.netWpm >= 100) {
    unlock('howler_monkey')
  }

  // 3. silverback
  if (newEntry.mode === 'speed' && newEntry.netWpm >= 150) {
    unlock('silverback')
  }

  // 4. zen_chimp
  if (newEntry.mode === 'speed' && newEntry.duration >= 30 && newEntry.fillerCount === 0) {
    unlock('zen_chimp')
  }

  // 5. yap_master
  if (newEntry.mode === 'speed' && newEntry.duration >= 120) {
    unlock('yap_master')
  }

  // 6. clarity_s
  if (newEntry.mode === 'clarity' && newEntry.accuracy >= 98) {
    unlock('clarity_s')
  }

  // 7. twister_master
  if (newEntry.promptType === 'tongue-twisters' && newEntry.accuracy >= 85) {
    unlock('twister_master')
  }

  // 8. chatterbox
  if (lifetime.totalWords >= 2000) {
    unlock('chatterbox')
  }

  return newUnlocked
}
