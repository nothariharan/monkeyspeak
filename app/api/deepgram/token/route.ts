import { createClient } from '@deepgram/sdk'
import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { appendSessionDebugLine } from '@/lib/debugSessionLog'

/** Avoid stale compiled handler + CDN-ish caching. */
export const dynamic = 'force-dynamic'

// #region agent log
function keyFingerprint(k: string | undefined): string {
  if (!k) return 'none'
  return createHash('sha256').update(k).digest('hex').slice(0, 8)
}
async function dbgLog(payload: Record<string, unknown>) {
  await appendSessionDebugLine({
    sessionId: 'b9a7e7',
    runId: 'skip-grant-test',
    timestamp: Date.now(),
    ...payload,
  })
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
 * Server-side WS connectivity probe: tries to open a WebSocket from Node (bypasses
 * browser restrictions) to confirm api.deepgram.com is reachable at all.
 */
// #region agent log
async function probeServerSideWs(rawApiKey: string): Promise<{ ok: boolean; code?: number; reason?: string; error?: string }> {
  try {
    const { default: WS } = await import('ws')
    const url = `wss://api.deepgram.com/v1/listen?model=nova-3&language=en-US&encoding=linear16&sample_rate=16000`
    return new Promise((resolve) => {
      // Server-side: use Authorization header (proper HTTP auth, impossible in browsers)
      const ws = new WS(url, { headers: { Authorization: `Token ${rawApiKey}` } })
      const timeout = setTimeout(() => {
        ws.terminate()
        resolve({ ok: false, error: 'timeout_5s' })
      }, 5000)
      ws.on('open', () => {
        clearTimeout(timeout)
        ws.close()
        resolve({ ok: true })
      })
      ws.on('error', (err: Error) => {
        clearTimeout(timeout)
        resolve({ ok: false, error: err.message.slice(0, 200) })
      })
      ws.on('close', (code: number, reason: Buffer) => {
        clearTimeout(timeout)
        resolve({ ok: false, code, reason: reason.toString().slice(0, 200) })
      })
    })
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}
// #endregion

/**
 * Issues a short-lived Deepgram JWT for the browser SDK via auth.grantToken().
 * Falls back to the raw API key only if grant fails or DEEPGRAM_SKIP_GRANT_TOKEN=true.
 */
export async function POST() {
  const apiKey = process.env.DEEPGRAM_API_KEY
  const skipGrant = process.env.DEEPGRAM_SKIP_GRANT_TOKEN === 'true'

  // #region agent log
  await dbgLog({
    hypothesisId: 'H1_server_key',
    location: 'app/api/deepgram/token/route.ts:POST',
    message: 'token_route_hit',
    data: { keyFp: keyFingerprint(apiKey), keyLen: apiKey?.length ?? 0, skipGrant },
  })
  // #endregion

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

      // #region agent log
      await dbgLog({
        hypothesisId: 'H2_grantToken_outcome',
        location: 'app/api/deepgram/token/route.ts:POST',
        message: 'grantToken_returned',
        data: {
          hasError: Boolean(error),
          errorPreview: error ? formatGrantError(error).slice(0, 200) : null,
          hasToken: Boolean(result?.access_token),
        },
      })
      // #endregion

      if (!error && result?.access_token) {
        tokenToReturn = result.access_token
        issuedVia = 'jwt'
      } else {
        console.warn(`[deepgram/token] grantToken unavailable; falling back to API key.`)
      }
    } catch (err) {
      console.warn(`[deepgram/token] grantToken threw; falling back to API key.`)
    }
  }

  // #region agent log — server-side WS probe with raw API key + Authorization header
  const probeResult = await probeServerSideWs(apiKey)
  await dbgLog({
    hypothesisId: 'H6_server_ws_probe',
    location: 'app/api/deepgram/token/route.ts:POST',
    message: 'server_side_ws_probe',
    data: { ...probeResult, issuedVia },
  })
  // #endregion

  return NextResponse.json(
    devTokenPayload({ token: tokenToReturn, ttlSeconds: issuedVia === 'jwt' ? 28 : 3600 }, issuedVia),
    { headers: devIssuedViaHeader(issuedVia) }
  )
}

export async function GET() {
  return POST()
}
