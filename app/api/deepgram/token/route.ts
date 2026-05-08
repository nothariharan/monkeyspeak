import { createClient } from '@deepgram/sdk'
import { NextResponse } from 'next/server'

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
 * When grantToken succeeds, the API key stays on the server.
 *
 * Keys without token-grant permission return 403; we skip grant by default
 * (fast path returns the key via env for local/dev). Enable grant with:
 * DEEPGRAM_ENABLE_GRANT_TOKEN=true when using a scoped key that can grant.
 */
export async function POST() {
  const apiKey = process.env.DEEPGRAM_API_KEY
  const grantEnabled = process.env.DEEPGRAM_ENABLE_GRANT_TOKEN === 'true'

  if (!apiKey) {
    return NextResponse.json(
      { error: 'DEEPGRAM_API_KEY not configured' },
      { status: 500 }
    )
  }

  if (!grantEnabled) {
    return NextResponse.json({ token: apiKey, ttlSeconds: 3600 })
  }

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

export async function GET() {
  return POST()
}
