import { appendFile } from 'fs/promises'
import { join } from 'path'
import { createClient } from '@deepgram/sdk'
import { NextResponse } from 'next/server'

// #region agent log
async function dbgSrvToken(line: Record<string, unknown>): Promise<void> {
  try {
    await appendFile(
      join(process.cwd(), 'debug-1ddc33.log'),
      `${JSON.stringify({ sessionId: '1ddc33', runId: 'verify5', timestamp: Date.now(), ...line })}\n`,
      'utf8'
    )
  } catch (e) {
    console.warn('[debug-1ddc33/token] append failed:', e)
  }
}
// #endregion

function formatGrantError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: string }).message
    if (typeof m === 'string' && m.length > 0) return m
  }
  if (err instanceof Error && err.message) return err.message
  return String(err)
}

/**
 * Issues a short-lived Deepgram temporary token via the SDK.
 * The real DEEPGRAM_API_KEY never leaves the server when grantToken succeeds.
 *
 * Keys without "create temporary token" / project auth scope return 403
 * (`Insufficient permissions`); we then fall back to the key so local dev still works.
 * For production, use a key that can call auth.grantToken() so the browser never sees the master key.
 */
export async function POST() {
  const apiKey = process.env.DEEPGRAM_API_KEY

  if (!apiKey) {
    await dbgSrvToken({
      hypothesisId: 'H-srv-token',
      location: 'deepgram/token/route.ts:POST',
      message: 'missing DEEPGRAM_API_KEY',
    })
    return NextResponse.json(
      { error: 'DEEPGRAM_API_KEY not configured' },
      { status: 500 }
    )
  }

  await dbgSrvToken({
    hypothesisId: 'H-srv-token',
    location: 'deepgram/token/route.ts:POST',
    message: 'token route ok (key present)',
    data: { cwd: process.cwd(), nodeEnv: process.env.NODE_ENV },
  })

  try {
    const deepgram = createClient(apiKey)
    const { result, error } = await deepgram.auth.grantToken()

    if (error || !result?.access_token) {
      const hint = formatGrantError(error ?? 'unknown')
      console.warn(
        `[deepgram/token] grantToken unavailable (${hint.slice(0, 200)}); responding with API key (prefer a key with token grant permissions).`
      )
      return NextResponse.json({ token: apiKey, ttlSeconds: 3600 })
    }

    return NextResponse.json({ token: result.access_token, ttlSeconds: 28 })
  } catch (err) {
    console.warn(
      `[deepgram/token] grantToken threw (${formatGrantError(err).slice(0, 200)}); falling back to API key.`
    )
    return NextResponse.json({ token: apiKey, ttlSeconds: 3600 })
  }
}

// Keep GET for backward compat with any cached calls during hot-reload
export async function GET() {
  return POST()
}
