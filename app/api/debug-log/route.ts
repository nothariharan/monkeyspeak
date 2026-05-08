import { NextResponse } from 'next/server'
import { appendSessionDebugLine } from '@/lib/debugSessionLog'

export async function POST(req: Request) {
  try {
    const payload = await req.json()
    await appendSessionDebugLine(payload as Record<string, unknown>)
    await fetch('http://127.0.0.1:7291/ingest/74562f5e-377a-4199-9293-9988125476d2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '26db2b',
      },
      body: JSON.stringify(payload),
    }).catch(() => {})
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
