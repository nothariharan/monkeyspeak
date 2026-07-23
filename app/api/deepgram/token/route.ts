import { createClient } from '@deepgram/sdk'
import { NextResponse } from 'next/server'
import { clientIp } from '@/lib/security/clientIp'
import { hitRateLimit } from '@/lib/security/rateLimit'
import { verifySessionGrant } from '@/lib/security/sessionGrant'

/** Avoid stale compiled handler + CDN-ish caching. */
export const dynamic = 'force-dynamic'

const EPHEMERAL_TTL_SECONDS = 60

type IssuedVia = 'ephemeral' | 'jwt' | 'none'

function devIssuedViaHeader(issuedVia: IssuedVia): HeadersInit {
  if (process.env.NODE_ENV !== 'development') return {}
  return { 'X-Debug-Token-Issued-Via': issuedVia }
}

function devTokenPayload(
  base: { token: string; ttlSeconds: number },
  via: Exclude<IssuedVia, 'none'>
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

function readSession(request: Request): string | null {
  const header = request.headers.get('x-ms-session')
  if (header) return header
  try {
    return new URL(request.url).searchParams.get('session')
  } catch {
    return null
  }
}

/**
 * Short-lived project key for browser WebSocket subprotocol auth.
 * JWTs from grantToken() are too long for Sec-WebSocket-Protocol and fail in browsers.
 */
async function issueEphemeralListenKey(
  apiKey: string,
  projectId: string
): Promise<{ token: string; ttlSeconds: number } | null> {
  try {
    const response = await fetch(`https://api.deepgram.com/v1/projects/${projectId}/keys`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment: 'monkeyspeak-browser',
        scopes: ['usage:write'],
        time_to_live_in_seconds: EPHEMERAL_TTL_SECONDS,
      }),
    })

    if (!response.ok) {
      console.warn(`[deepgram/token] ephemeral key creation failed: ${response.status}`)
      return null
    }

    const data = (await response.json()) as { key?: string }
    if (!data.key) return null

    return { token: data.key, ttlSeconds: EPHEMERAL_TTL_SECONDS }
  } catch (err) {
    console.warn(`[deepgram/token] ephemeral key creation threw (${formatGrantError(err)})`)
    return null
  }
}

/**
 * Issues a short-lived Deepgram credential for browser live listen.
 * Requires a prior /api/deepgram/session grant.
 */
export async function POST(request: Request) {
  const ip = clientIp(request)
  if (!hitRateLimit(`dg-token:${ip}`, { windowMs: 60_000, max: 8 })) {
    return NextResponse.json({ error: 'slow down — too many token requests' }, { status: 429 })
  }

  const sessionCheck = verifySessionGrant(readSession(request), 'deepgram')
  if (!sessionCheck.ok) {
    return NextResponse.json({ error: sessionCheck.error }, { status: 401 })
  }

  const apiKey = process.env.DEEPGRAM_API_KEY
  const projectId = process.env.DEEPGRAM_PROJECT_ID

  if (!apiKey) {
    return NextResponse.json({ error: 'DEEPGRAM_API_KEY not configured' }, {
      status: 500,
      headers: devIssuedViaHeader('none'),
    })
  }

  if (projectId) {
    const ephemeral = await issueEphemeralListenKey(apiKey, projectId)
    if (ephemeral) {
      return NextResponse.json(
        devTokenPayload(ephemeral, 'ephemeral'),
        { headers: devIssuedViaHeader('ephemeral') }
      )
    }
  }

  try {
    const deepgram = createClient(apiKey)
    const { result, error } = await deepgram.auth.grantToken()

    if (error || !result?.access_token) {
      console.warn(`[deepgram/token] grantToken unavailable (${formatGrantError(error)})`)
      return NextResponse.json(
        {
          error: projectId
            ? 'Unable to issue Deepgram token. Try again later.'
            : 'DEEPGRAM_PROJECT_ID not configured — cannot issue browser-safe listen keys.',
        },
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

/** GET minting removed — use POST with a session grant. */
export async function GET() {
  return NextResponse.json(
    { error: 'use POST /api/deepgram/token with an x-ms-session header' },
    { status: 405 }
  )
}
