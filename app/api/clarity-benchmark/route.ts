import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/admin'
import { fetchClarityLeaderboard, isClarityPromptType, saveClarityBenchmark, validateClaritySubmission } from '@/lib/clarityLeaderboard/server'
import { clientIp } from '@/lib/security/clientIp'
import { hitRateLimit } from '@/lib/security/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'clarity benchmark is not configured' }, { status: 503 })
  const url = new URL(request.url)
  const promptParam = url.searchParams.get('promptType')
  const promptType = promptParam && isClarityPromptType(promptParam) ? promptParam : undefined
  const limitParam = Number(url.searchParams.get('limit'))
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined
  try { return NextResponse.json({ rows: await fetchClarityLeaderboard({ promptType, limit }) }) }
  catch (error) { console.warn('[clarity-benchmark/get]', error); return NextResponse.json({ error: 'could not load clarity board' }, { status: 500 }) }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'clarity benchmark is not configured' }, { status: 503 })

  const ip = clientIp(request)
  if (!hitRateLimit(`clarity:${ip}`, { windowMs: 30_000, max: 1 })) {
    return NextResponse.json({ error: 'slow down — try again in a bit' }, { status: 429 })
  }

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }
  const submission = validateClaritySubmission(body)
  if ('error' in submission) return NextResponse.json({ error: submission.error }, { status: 400 })
  try { await saveClarityBenchmark(submission); return NextResponse.json({ ok: true }, { status: 201 }) }
  catch (error) { console.warn('[clarity-benchmark/post]', error); return NextResponse.json({ error: 'could not save benchmark result' }, { status: 500 }) }
}
