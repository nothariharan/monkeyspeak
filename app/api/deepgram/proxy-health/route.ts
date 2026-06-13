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

export async function GET() {
  const origin = proxyHttpOrigin()
  if (!origin) {
    return NextResponse.json({ ok: false, err: 'no proxy configured' })
  }

  try {
    const r = await fetch(origin, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    return NextResponse.json({ ok: r.ok, status: r.status })
  } catch (e) {
    return NextResponse.json({ ok: false, err: String(e) })
  }
}
