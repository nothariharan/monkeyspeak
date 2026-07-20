import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/admin'
import { fetchClarityLeaderboard, saveClarityBenchmark, validateClaritySubmission } from '@/lib/clarityLeaderboard/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'clarity benchmark is not configured' }, { status: 503 })
  try { return NextResponse.json({ rows: await fetchClarityLeaderboard() }) }
  catch (error) { console.warn('[clarity-benchmark/get]', error); return NextResponse.json({ error: 'could not load clarity board' }, { status: 500 }) }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'clarity benchmark is not configured' }, { status: 503 })
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }
  const submission = validateClaritySubmission(body)
  if ('error' in submission) return NextResponse.json({ error: submission.error }, { status: 400 })
  try { await saveClarityBenchmark(submission); return NextResponse.json({ ok: true }, { status: 201 }) }
  catch (error) { console.warn('[clarity-benchmark/post]', error); return NextResponse.json({ error: 'could not save benchmark result' }, { status: 500 }) }
}
