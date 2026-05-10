import { createClient } from '@deepgram/sdk'
import { NextResponse } from 'next/server'
import { appendDebug08Line } from '@/lib/debug08'
import { appendSessionDebugLine } from '@/lib/debugSessionLog'

/** Avoid stale compiled handler + CDN-ish caching during local debugging */
export const dynamic = 'force-dynamic'

const DEBUG_INGEST_URL = process.env.DEBUG_INGEST_URL

function devIssuedViaHeader(issuedVia: 'jwt' | 'api_key' | 'none'): HeadersInit {
  if (process.env.NODE_ENV !== 'development') return {}
  return { 'X-Debug-Token-Issued-Via': issuedVia }
}

/** Dev-only: readable in Network response JSON when log files desync from this workspace */
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
 * Issues a short-lived Deepgram token for the browser SDK.
 * Prefers `auth.grantToken()` (JWT, stays off the client bundle) when the key allows it.
 * Falls back to returning the API key only if grant fails or `DEEPGRAM_SKIP_GRANT_TOKEN=true`.
 */
export async function POST() {
  const apiKey = process.env.DEEPGRAM_API_KEY
  const skipGrant = process.env.DEEPGRAM_SKIP_GRANT_TOKEN === 'true'
  // #region agent log
  const tokenProbePayload = {
    sessionId: '08c9af',
    runId: 'post-fix',
    hypothesisId: 'H2_token_route',
    location: 'app/api/deepgram/token/route.ts:POST',
    message: 'Token route hit',
    data: { skipGrant, hasApiKey: Boolean(apiKey), hasProjectId: Boolean(process.env.DEEPGRAM_PROJECT_ID) },
    timestamp: Date.now(),
  }
  const probeRecord = tokenProbePayload as unknown as Record<string, unknown>
  await appendDebug08Line(probeRecord)
  await appendSessionDebugLine(probeRecord)
  if (DEBUG_INGEST_URL) {
    fetch(DEBUG_INGEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '08c9af',
      },
      body: JSON.stringify(tokenProbePayload),
    }).catch(() => {})
  }
  // #endregion

  if (!apiKey) {
    const errBody =
      process.env.NODE_ENV === 'development'
        ? { error: 'DEEPGRAM_API_KEY not configured', _debugIssuedVia: 'none' as const }
        : { error: 'DEEPGRAM_API_KEY not configured' }
    return NextResponse.json(errBody, { status: 500, headers: devIssuedViaHeader('none') })
  }

  if (!skipGrant) {
    try {
      const deepgram = createClient(apiKey)
      const projectId = process.env.DEEPGRAM_PROJECT_ID
      // Use the project-scoped endpoint when DEEPGRAM_PROJECT_ID is set.
      // Without a project ID, Deepgram returns FORBIDDEN even for valid keys.
      const grantEndpoint = projectId
        ? (`:version/projects/${projectId}/auth/grant` as const)
        : undefined
      const { result, error } = await deepgram.auth.grantToken(grantEndpoint)

      if (!error && result?.access_token) {
        // #region agent log
        const jwtRec = {
          sessionId: '08c9af',
          runId: 'post-fix',
          hypothesisId: 'H3_token_issued',
          location: 'app/api/deepgram/token/route.ts:POST',
          message: 'token_ready',
          data: { issuedVia: 'jwt' },
          timestamp: Date.now(),
        } as Record<string, unknown>
        await appendDebug08Line(jwtRec)
        await appendSessionDebugLine(jwtRec)
        // #endregion
        return NextResponse.json(devTokenPayload({ token: result.access_token, ttlSeconds: 28 }, 'jwt'), {
          headers: devIssuedViaHeader('jwt'),
        })
      }

      const hint = formatGrantError(error ?? 'unknown')
      console.warn(
        `[deepgram/token] grantToken unavailable (${hint.slice(0, 200)}); falling back to API key.`
      )
    } catch (err) {
      console.warn(
        `[deepgram/token] grantToken threw (${formatGrantError(err).slice(0, 200)}); falling back to API key.`
      )
    }
  }

  // #region agent log
  const keyRec = {
    sessionId: '08c9af',
    runId: 'post-fix',
    hypothesisId: 'H3_token_issued',
    location: 'app/api/deepgram/token/route.ts:POST',
    message: 'token_ready',
    data: { issuedVia: 'api_key' },
    timestamp: Date.now(),
  } as Record<string, unknown>
  await appendDebug08Line(keyRec)
  await appendSessionDebugLine(keyRec)
  // #endregion

  return NextResponse.json(devTokenPayload({ token: apiKey, ttlSeconds: 3600 }, 'api_key'), {
    headers: devIssuedViaHeader('api_key'),
  })
}

export async function GET() {
  return POST()
}
