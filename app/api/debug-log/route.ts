import { NextResponse } from 'next/server'
import { appendSessionDebugLine } from '@/lib/debugSessionLog'
import { appendDebug08Line } from '@/lib/debug08'

const DEBUG_INGEST_URL = process.env.DEBUG_INGEST_URL

export async function POST(req: Request) {
  try {
    const payload = await req.json()
    await appendDebug08Line(payload as Record<string, unknown>)
    await appendSessionDebugLine(payload as Record<string, unknown>)
    if (DEBUG_INGEST_URL) {
      await fetch(DEBUG_INGEST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(typeof payload === 'object' &&
          payload !== null &&
          'sessionId' in payload &&
          typeof (payload as { sessionId?: unknown }).sessionId === 'string'
            ? { 'X-Debug-Session-Id': (payload as { sessionId: string }).sessionId }
            : {}),
        },
        body: JSON.stringify(payload),
      }).catch(() => {})
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

/** Smoke test: GET creates a line in debug-26db2b.log without browser speech. */
export async function GET() {
  const payload = {
    sessionId: '26db2b',
    runId: 'bootstrap',
    hypothesisId: 'H0_logging_pipeline',
    location: 'app/api/debug-log/route.ts:GET',
    message: 'debug-log route reachable',
    data: { cwd: process.cwd() },
    timestamp: Date.now(),
  }
  await appendSessionDebugLine(payload)
  return NextResponse.json({ ok: true, payload })
}
