import { NextResponse } from 'next/server'
import { clientIp } from '@/lib/security/clientIp'
import { hitRateLimit } from '@/lib/security/rateLimit'

export const dynamic = 'force-dynamic'

type CacheEntry = { at: number; body: { ok: boolean; status?: number; err?: string } }
let cache: CacheEntry | null = null
const CACHE_MS = 8_000

function proxyHttpOrigin() {
  const base = process.env.NEXT_PUBLIC_DEEPGRAM_PROXY_URL
  if (!base || base === 'direct') return null
  try {
    const u = new URL(base)
    const proto = u.protocol === 'wss:' ? 'https:' : 'http:'
    return `${proto}//${u.host}/`
  } catch {
    return null
  }
}

async function probeOnce(origin: string, timeoutMs: number) {
  const r = await fetch(origin, {
    method: 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  })
  return { ok: r.ok, status: r.status }
}

export async function GET(request: Request) {
  const ip = clientIp(request)
  if (!hitRateLimit(`dg-health:${ip}`, { windowMs: 20_000, max: 6 })) {
    return NextResponse.json({ ok: false, err: 'slow down' }, { status: 429 })
  }

  if (cache && Date.now() - cache.at < CACHE_MS) {
    return NextResponse.json(cache.body)
  }

  const origin = proxyHttpOrigin()
  if (!origin) {
    return NextResponse.json({ ok: false, err: 'no proxy configured' })
  }

  // Render free tier cold starts often exceed 8s — one short attempt then a longer
  // retry avoids falling through to the Vercel HTTP bridge (which rarely streams Results).
  const attempts = [8_000, 20_000]
  let lastErr = 'proxy unreachable'
  for (let i = 0; i < attempts.length; i++) {
    try {
      const result = await probeOnce(origin, attempts[i]!)
      if (result.ok) {
        cache = { at: Date.now(), body: result }
        return NextResponse.json(result)
      }
      lastErr = `proxy returned ${result.status}`
    } catch (e) {
      lastErr = String(e)
      if (i < attempts.length - 1) {
        await new Promise((r) => setTimeout(r, 750))
      }
    }
  }
  const body = { ok: false, err: lastErr }
  cache = { at: Date.now(), body }
  return NextResponse.json(body)
}
