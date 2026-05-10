import { createClient } from '@deepgram/sdk'
import { NextResponse } from 'next/server'
import { createHash } from 'crypto'

/** Avoid stale compiled handler + CDN-ish caching. */
export const dynamic = 'force-dynamic'

// #region agent log
function dbgIngest(payload: Record<string, unknown>) {
  return fetch('http://127.0.0.1:7291/ingest/74562f5e-377a-4199-9293-9988125476d2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b9a7e7' },
    body: JSON.stringify({ sessionId: 'b9a7e7', runId: 'owner-key-run', timestamp: Date.now(), ...payload }),
  }).catch(() => {})
}
function keyFingerprint(k: string | undefined): string {
  if (!k) return 'none'
  return createHash('sha256').update(k).digest('hex').slice(0, 8)
}
// #endregion

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

  // #region agent log
  await dbgIngest({
    hypothesisId: 'H1_server_key',
    location: 'app/api/deepgram/token/route.ts:POST',
    message: 'token_route_hit',
    data: {
      keyFp: keyFingerprint(apiKey),
      keyLen: apiKey?.length ?? 0,
      skipGrant,
      nodeEnv: process.env.NODE_ENV,
    },
  })
  // #endregion

  if (!apiKey) {
    return NextResponse.json({ error: 'DEEPGRAM_API_KEY not configured' }, {
      status: 500,
      headers: devIssuedViaHeader('none'),
    })
  }

  if (!skipGrant) {
    try {
      const deepgram = createClient(apiKey)
      const { result, error } = await deepgram.auth.grantToken()

      // #region agent log
      await dbgIngest({
        hypothesisId: 'H2_grantToken_outcome',
        location: 'app/api/deepgram/token/route.ts:POST',
        message: 'grantToken_returned',
        data: {
          hasError: Boolean(error),
          errorPreview: error ? formatGrantError(error).slice(0, 200) : null,
          hasToken: Boolean(result?.access_token),
          tokenIsJwt: result?.access_token
            ? result.access_token.startsWith('eyJ') && result.access_token.split('.').length === 3
            : false,
        },
      })
      // #endregion

      if (!error && result?.access_token) {
        return NextResponse.json(
          devTokenPayload({ token: result.access_token, ttlSeconds: 28 }, 'jwt'),
          { headers: devIssuedViaHeader('jwt') }
        )
      }

      console.warn(
        `[deepgram/token] grantToken unavailable (${formatGrantError(error ?? 'unknown').slice(0, 200)}); falling back to API key.`
      )
    } catch (err) {
      // #region agent log
      await dbgIngest({
        hypothesisId: 'H2_grantToken_outcome',
        location: 'app/api/deepgram/token/route.ts:POST',
        message: 'grantToken_threw',
        data: { errorPreview: formatGrantError(err).slice(0, 200) },
      })
      // #endregion
      console.warn(
        `[deepgram/token] grantToken threw (${formatGrantError(err).slice(0, 200)}); falling back to API key.`
      )
    }
  }

  // #region agent log
  await dbgIngest({
    hypothesisId: 'H3_branch_taken',
    location: 'app/api/deepgram/token/route.ts:POST',
    message: 'returning_api_key_fallback',
    data: { keyFp: keyFingerprint(apiKey) },
  })
  // #endregion

  return NextResponse.json(
    devTokenPayload({ token: apiKey, ttlSeconds: 3600 }, 'api_key'),
    { headers: devIssuedViaHeader('api_key') }
  )
}

export async function GET() {
  return POST()
}
