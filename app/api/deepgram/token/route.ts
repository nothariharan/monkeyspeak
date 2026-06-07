import { createClient } from '@deepgram/sdk'
import { NextResponse } from 'next/server'

/** Avoid stale compiled handler + CDN-ish caching. */
export const dynamic = 'force-dynamic'

function devIssuedViaHeader(issuedVia: 'jwt' | 'none'): HeadersInit {
  if (process.env.NODE_ENV !== 'development') return {}
  return { 'X-Debug-Token-Issued-Via': issuedVia }
}

function devTokenPayload(
  base: { token: string; ttlSeconds: number },
  via: 'jwt'
): { token: string; ttlSeconds: number; _debugIssuedVia?: string } {
  if (process.env.NODE_ENV !== 'development') return base
  return { ...base, _debugIssuedVia: via }
}

function formatGrantError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: string }).message
    if (typeof m === 'string' && m.length > 0) return m
  }
  if (err instanceof Error && err.message) return err.message
  return String(err)
}

/**
 * Issues a short-lived Deepgram JWT for the browser SDK via auth.grantToken().
 * Never returns the permanent API key — only ephemeral JWTs.
 */
export async function POST() {
  const apiKey = process.env.DEEPGRAM_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'DEEPGRAM_API_KEY not configured' }, {
      status: 500,
      headers: devIssuedViaHeader('none'),
    })
  }

  try {
    const deepgram = createClient(apiKey)
    const { result, error } = await deepgram.auth.grantToken()

    if (error || !result?.access_token) {
      console.warn(`[deepgram/token] grantToken unavailable (${formatGrantError(error)})`)
      return NextResponse.json(
        { error: 'Unable to issue Deepgram token. Try again later.' },
        { status: 503, headers: devIssuedViaHeader('none') }
      )
    }

    return NextResponse.json(
      devTokenPayload({ token: result.access_token, ttlSeconds: 28 }, 'jwt'),
      { headers: devIssuedViaHeader('jwt') }
    )
  } catch (err) {
    console.warn(`[deepgram/token] grantToken threw (${formatGrantError(err)})`)
    return NextResponse.json(
      { error: 'Unable to issue Deepgram token. Try again later.' },
      { status: 503, headers: devIssuedViaHeader('none') }
    )
  }
}

export async function GET() {
  return POST()
}
