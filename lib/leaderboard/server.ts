import {
  DEFAULT_LEADERBOARD_EMOJI,
  LEADERBOARD_EMOJI_OPTIONS,
} from '@/lib/stats/leaderboard'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { verifySessionGrant } from '@/lib/security/sessionGrant'
import { checkCooldown } from '@/lib/security/rateLimit'
import type { Duration, LeaderboardEntry, PromptType } from '@/store/testStore'

const DURATIONS: Duration[] = [15, 30, 60, 120]
const PROMPT_TYPES: PromptType[] = ['sentences', 'numbers', 'custom', 'technical', 'tongue-twisters']
const EMOJI_SET = new Set<string>(LEADERBOARD_EMOJI_OPTIONS)

const RATE_WINDOW_MS = 30_000
/** Early-stop runs must reach this fraction of the configured duration to post. */
export const MIN_ELAPSED_RATIO = 0.9

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
  elapsedSec: number
  runToken: string
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
  const elapsedSec = Number(raw.elapsedSec)
  const runToken = typeof raw.runToken === 'string' ? raw.runToken : ''

  if (name.length < 2 || name.length > 18) return { error: 'name needs 2 to 18 characters' }
  if (!/^[A-Za-z0-9 _-]+$/.test(name)) return { error: 'name has invalid characters' }
  if (!EMOJI_SET.has(emoji)) return { error: 'pick an icon from the list' }
  if (!Number.isFinite(wpm) || wpm < 1 || wpm > 250) return { error: 'wpm looks suspicious' }
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) return { error: 'accuracy out of range' }
  if (!duration) return { error: 'invalid duration' }
  if (wpm > MAX_WPM_BY_DURATION[duration]) return { error: 'wpm looks suspicious' }
  if (!promptType) return { error: 'invalid prompt type' }
  if (!Number.isFinite(elapsedSec) || elapsedSec <= 0) return { error: 'missing elapsed time' }
  if (elapsedSec < duration * MIN_ELAPSED_RATIO) {
    return { error: 'finish the full timed run before posting to the board' }
  }
  if (elapsedSec > duration + 15) return { error: 'elapsed time looks suspicious' }

  const grant = verifySessionGrant(runToken, 'run', { duration, promptType })
  if (!grant.ok) return { error: grant.error }

  return {
    name,
    emoji,
    wpm: Math.round(wpm),
    accuracy: Math.round(accuracy),
    duration,
    promptType,
    elapsedSec,
    runToken,
  }
}

export function checkRateLimit(ip: string) {
  return checkCooldown(`leaderboard:${ip}`, RATE_WINDOW_MS)
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
