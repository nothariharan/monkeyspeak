import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

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

export async function GET() {
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
      if (result.ok) return NextResponse.json(result)
      lastErr = `proxy returned ${result.status}`
    } catch (e) {
      lastErr = String(e)
      // brief pause before the long retry so a waking instance can finish boot
      if (i < attempts.length - 1) {
        await new Promise((r) => setTimeout(r, 750))
      }
    }
  }
  return NextResponse.json({ ok: false, err: lastErr })
}
