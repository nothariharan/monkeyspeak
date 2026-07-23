import { NextResponse } from 'next/server'
import { clientIp } from '@/lib/security/clientIp'
import { hitRateLimit } from '@/lib/security/rateLimit'
import { issueSessionGrant } from '@/lib/security/sessionGrant'

export const dynamic = 'force-dynamic'

const VALID_DURATIONS = [15, 30, 60, 120]

export async function POST(request: Request) {
  const ip = clientIp(request)
  if (!hitRateLimit(`run-token:${ip}`, { windowMs: 60_000, max: 20 })) {
    return NextResponse.json({ error: 'slow down' }, { status: 429 })
  }

  let body: { duration?: number; promptType?: string } = {}
  try {
    body = (await request.json()) as { duration?: number; promptType?: string }
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const duration = Number(body.duration)
  if (!VALID_DURATIONS.includes(duration)) {
    return NextResponse.json({ error: 'invalid duration' }, { status: 400 })
  }

  const promptType = String(body.promptType ?? '').trim().slice(0, 40)
  if (!promptType) {
    return NextResponse.json({ error: 'invalid prompt type' }, { status: 400 })
  }

  // Bind duration + prompt for the full configured length (+ small grace for network).
  const runToken = issueSessionGrant('run', {
    duration,
    promptType,
    ttlMs: (duration + 90) * 1000,
  })

  return NextResponse.json({ runToken, duration, promptType })
}
