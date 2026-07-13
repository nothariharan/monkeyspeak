import type { Duration, PromptType } from '@/store/testStore'
import { getLocalDateStr } from '@/lib/stats/streak'

export const LEADERBOARD_DURATIONS: Duration[] = [15, 30, 60, 120]

// boards people can actually filter on the full page
export const LEADERBOARD_PROMPTS: { label: string; value: PromptType }[] = [
  { label: 'sentences', value: 'sentences' },
  { label: 'numbers', value: 'numbers' },
  { label: 'daily challenge', value: 'daily' },
  { label: 'custom', value: 'custom' },
  { label: 'technical', value: 'technical' },
  { label: 'tongue twisters', value: 'tongue-twisters' },
]

export const MEDAL_LABEL: Record<string, string> = {
  gold: '1',
  silver: '2',
  bronze: '3',
}

// daily boards are keyed by date on the server
export function resolveBoardPromptType(promptType: PromptType): PromptType {
  return promptType === 'daily' ? (`daily-${getLocalDateStr()}` as PromptType) : promptType
}

export function promptLabel(promptType: PromptType): string {
  if (promptType === 'daily' || promptType.startsWith('daily-')) return 'daily challenge'
  const match = LEADERBOARD_PROMPTS.find((p) => p.value === promptType)
  return match?.label ?? promptType
}

// url uses the short form — daily, not daily-2026-07-09
export function promptTypeFromUrl(value: string | null): PromptType {
  if (!value) return 'sentences'
  if (value === 'daily' || /^daily-\d{4}-\d{2}-\d{2}$/.test(value)) return 'daily'
  const allowed = LEADERBOARD_PROMPTS.map((p) => p.value)
  return allowed.includes(value as PromptType) ? (value as PromptType) : 'sentences'
}

export function promptTypeToUrl(promptType: PromptType): string {
  return promptType === 'daily' || promptType.startsWith('daily-') ? 'daily' : promptType
}

export function parseDurationParam(value: string | null): Duration {
  const n = Number(value)
  return LEADERBOARD_DURATIONS.includes(n as Duration) ? (n as Duration) : 30
}

export function formatBoardDate(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''

  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days < 1) return 'today'
  if (days === 1) return '1d ago'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
