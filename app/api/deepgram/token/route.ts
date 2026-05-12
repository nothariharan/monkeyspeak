import { createClient } from '@deepgram/sdk'
import { NextResponse } from 'next/server'

/** Avoid stale compiled handler + CDN-ish caching. */
export const dynamic = 'force-dynamic'

function devIssuedViaHeader(issuedVia: 'jwt' | 'api_key' | 'none'): HeadersInit {
  if (process.env.NODE_ENV !== 'development') return {}
  return { 'X-Debug-Token-Issued-Via': issuedVia }
}

function devTokenPayload(
  base: { token: string; ttlSeconds: number },
  via: 'jwt' | 'api_key'
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
 * Falls back to the raw API key only if grant fails or DEEPGRAM_SKIP_GRANT_TOKEN=true.
 */
export async function POST() {
  const apiKey = process.env.DEEPGRAM_API_KEY
  const skipGrant = process.env.DEEPGRAM_SKIP_GRANT_TOKEN === 'true'

  if (!apiKey) {
    return NextResponse.json({ error: 'DEEPGRAM_API_KEY not configured' }, {
      status: 500,
      headers: devIssuedViaHeader('none'),
    })
  }

  let tokenToReturn = apiKey
  let issuedVia: 'jwt' | 'api_key' = 'api_key'

  if (!skipGrant) {
    try {
      const deepgram = createClient(apiKey)
      const { result, error } = await deepgram.auth.grantToken()

      if (!error && result?.access_token) {
        tokenToReturn = result.access_token
        issuedVia = 'jwt'
      } else {
        console.warn(`[deepgram/token] grantToken unavailable (${formatGrantError(error)}); falling back to API key.`)
      }
    } catch {
      console.warn(`[deepgram/token] grantToken threw; falling back to API key.`)
    }
  }

  return NextResponse.json(
    devTokenPayload({ token: tokenToReturn, ttlSeconds: issuedVia === 'jwt' ? 28 : 3600 }, issuedVia),
    { headers: devIssuedViaHeader(issuedVia) }
  )
}

export async function GET() {
  return POST()
}
