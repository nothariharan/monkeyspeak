import { NextResponse } from 'next/server'
import { clientIp } from '@/lib/security/clientIp'
import { hitRateLimit } from '@/lib/security/rateLimit'
import { issueSessionGrant } from '@/lib/security/sessionGrant'

export const dynamic = 'force-dynamic'

const VALID_DURATIONS = [15, 30, 60, 120]

export async function POST(request: Request) {
  const ip = clientIp(request)
  if (!hitRateLimit(`dg-session:${ip}`, { windowMs: 60_000, max: 12 })) {
    return NextResponse.json({ error: 'slow down — too many speech sessions' }, { status: 429 })
  }

  let body: { duration?: number } = {}
  try {
    body = (await request.json()) as { duration?: number }
  } catch {
    body = {}
  }

  const duration = VALID_DURATIONS.includes(Number(body.duration) as 15 | 30 | 60 | 120)
    ? Number(body.duration)
    : 60

  const session = issueSessionGrant('deepgram', { duration, ttlMs: 180_000 })
  return NextResponse.json({ session, duration, ttlSeconds: 180 })
}
