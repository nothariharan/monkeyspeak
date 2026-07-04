import {
  DEFAULT_LEADERBOARD_EMOJI,
  LEADERBOARD_EMOJI_OPTIONS,
} from '@/lib/stats/leaderboard'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { Duration, LeaderboardEntry, PromptType } from '@/store/testStore'

const DURATIONS: Duration[] = [15, 30, 60, 120]
const PROMPT_TYPES: PromptType[] = ['sentences', 'numbers', 'custom', 'technical', 'tongue-twisters']
const EMOJI_SET = new Set<string>(LEADERBOARD_EMOJI_OPTIONS)

const rateLimit = new Map<string, number>()
const RATE_WINDOW_MS = 30_000

// rough wpm ceilings per duration — defense in depth not anti-cheat
// signed run tokens are the real fix when we get there
const MAX_WPM_BY_DURATION: Record<Duration, number> = {
  15: 260,
  30: 240,
  60: 220,
  120: 210,
}

type DbRow = {
  id: string
  name: string
  emoji: string
  wpm: number
  accuracy: number
  duration: number
  prompt_type: string
  created_at: string
}

export type SubmitPayload = {
  name: string
  emoji: string
  wpm: number
  accuracy: number
  duration: Duration
  promptType: PromptType
}

function cleanName(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function parseDuration(value: string | null): Duration | null {
  const n = Number(value)
  return DURATIONS.includes(n as Duration) ? (n as Duration) : null
}

export function parsePromptType(value: string | null): PromptType | null {
  if (!value) return null
  if (/^daily(-\d{4}-\d{2}-\d{2})?$/.test(value)) {
    return value as PromptType
  }
  return PROMPT_TYPES.includes(value as PromptType) ? (value as PromptType) : null
}

export function parseLimit(value: string | null, fallback = 20) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(50, Math.max(1, Math.floor(n)))
}

function rowToEntry(row: DbRow): LeaderboardEntry {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    wpm: row.wpm,
    accuracy: row.accuracy,
    duration: row.duration as Duration,
    promptType: row.prompt_type as PromptType,
    date: row.created_at,
  }
}

export function validateSubmitPayload(body: unknown): SubmitPayload | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'invalid body' }

  const raw = body as Record<string, unknown>
  const name = cleanName(String(raw.name ?? ''))
  const emoji = String(raw.emoji ?? DEFAULT_LEADERBOARD_EMOJI)
  const wpm = Number(raw.wpm)
  const accuracy = Number(raw.accuracy)
  const duration = parseDuration(String(raw.duration ?? ''))
  const promptType = parsePromptType(String(raw.promptType ?? ''))

  if (name.length < 2 || name.length > 18) return { error: 'name needs 2 to 18 characters' }
  if (/[%_]/.test(name)) return { error: 'name has invalid characters' }
  if (!EMOJI_SET.has(emoji)) return { error: 'pick an icon from the list' }
  if (!Number.isFinite(wpm) || wpm < 1 || wpm > 250) return { error: 'wpm looks suspicious' }
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) return { error: 'accuracy out of range' }
  if (!duration) return { error: 'invalid duration' }
  if (wpm > MAX_WPM_BY_DURATION[duration]) return { error: 'wpm looks suspicious' }
  if (!promptType) return { error: 'invalid prompt type' }

  return { name, emoji, wpm: Math.round(wpm), accuracy: Math.round(accuracy), duration, promptType }
}

export function checkRateLimit(ip: string) {
  const now = Date.now()
  const last = rateLimit.get(ip) ?? 0
  if (now - last < RATE_WINDOW_MS) return false
  rateLimit.set(ip, now)

  // trim stale rate limit entries
  if (rateLimit.size > 500) {
    rateLimit.forEach((ts, key) => {
      if (now - ts > RATE_WINDOW_MS * 2) rateLimit.delete(key)
    })
  }

  return true
}

export async function fetchLeaderboardEntries(
  duration: Duration,
  promptType: PromptType,
  limit: number
): Promise<LeaderboardEntry[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('leaderboard_entries')
    .select('id, name, emoji, wpm, accuracy, duration, prompt_type, created_at')
    .eq('duration', duration)
    .eq('prompt_type', promptType)
    .order('wpm', { ascending: false })
    .order('accuracy', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data as DbRow[]).map(rowToEntry)
}

export async function submitLeaderboardEntry(payload: SubmitPayload): Promise<LeaderboardEntry> {
  const supabase = getSupabaseAdmin()
  const nameKey = payload.name.toLowerCase()

  const { data: existingRows, error: findError } = await supabase
    .from('leaderboard_entries')
    .select('id, name, emoji, wpm, accuracy, duration, prompt_type, created_at')
    .eq('duration', payload.duration)
    .eq('prompt_type', payload.promptType)
    .ilike('name', payload.name)

  if (findError) throw findError

  const existing = (existingRows as DbRow[] | null)?.find(
    (row) => row.name.trim().toLowerCase() === nameKey
  )

  if (existing) {
    if (payload.wpm <= existing.wpm) return rowToEntry(existing)

    const { data, error } = await supabase
      .from('leaderboard_entries')
      .update({
        emoji: payload.emoji,
        wpm: payload.wpm,
        accuracy: payload.accuracy,
        created_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('id, name, emoji, wpm, accuracy, duration, prompt_type, created_at')
      .single()

    if (error) throw error
    return rowToEntry(data as DbRow)
  }

  const { data, error } = await supabase
    .from('leaderboard_entries')
    .insert({
      name: payload.name,
      emoji: payload.emoji,
      wpm: payload.wpm,
      accuracy: payload.accuracy,
      duration: payload.duration,
      prompt_type: payload.promptType,
    })
    .select('id, name, emoji, wpm, accuracy, duration, prompt_type, created_at')
    .single()

  if (error) throw error
  return rowToEntry(data as DbRow)
}
