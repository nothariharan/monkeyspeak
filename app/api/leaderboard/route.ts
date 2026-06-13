import { NextResponse } from 'next/server'
import {
  checkRateLimit,
  fetchLeaderboardEntries,
  parseDuration,
  parseLimit,
  parsePromptType,
  submitLeaderboardEntry,
  validateSubmitPayload,
} from '@/lib/leaderboard/server'
import { isSupabaseConfigured } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function clientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return request.headers.get('x-real-ip') ?? 'unknown'
}

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'leaderboard not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const duration = parseDuration(searchParams.get('duration'))
  const promptType = parsePromptType(searchParams.get('promptType'))
  const limit = parseLimit(searchParams.get('limit'))

  if (!duration || !promptType) {
    return NextResponse.json({ error: 'bad board params' }, { status: 400 })
  }

  try {
    const entries = await fetchLeaderboardEntries(duration, promptType, limit)
    return NextResponse.json({ entries })
  } catch (err) {
    console.warn('[leaderboard/get]', err)
    return NextResponse.json({ error: 'could not load leaderboard' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'leaderboard not configured' }, { status: 503 })
  }

  if (!checkRateLimit(clientIp(request))) {
    return NextResponse.json({ error: 'slow down — try again in a bit' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const parsed = validateSubmitPayload(body)
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  try {
    const entry = await submitLeaderboardEntry(parsed)
    return NextResponse.json({ entry })
  } catch (err) {
    console.warn('[leaderboard/post]', err)
    return NextResponse.json({ error: 'could not save score' }, { status: 500 })
  }
}
