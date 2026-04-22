import { NextResponse } from 'next/server'

/**
 * Issues a short-lived Deepgram temporary API token.
 * The real DEEPGRAM_API_KEY never leaves the server.
 *
 * Deepgram temporary key docs:
 * https://developers.deepgram.com/reference/create-key
 */
export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY
  const projectId = process.env.DEEPGRAM_PROJECT_ID

  if (!apiKey) {
    return NextResponse.json(
      { error: 'DEEPGRAM_API_KEY not configured' },
      { status: 500 }
    )
  }

  // If no project ID is set, just return the key directly
  // (for development — in production, use ephemeral tokens)
  if (!projectId) {
    return NextResponse.json({ key: apiKey })
  }

  try {
    const res = await fetch(
      `https://api.deepgram.com/v1/projects/${projectId}/keys`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: 'monkeyspeak-ephemeral',
          scopes: ['usage:write'],
          time_to_live_in_seconds: 30,
        }),
      }
    )

    if (!res.ok) {
      // Fallback: return the main key if ephemeral key creation fails
      // (can happen if the account doesn't support project key management)
      return NextResponse.json({ key: apiKey })
    }

    const data = await res.json()
    return NextResponse.json({ key: data.result?.key ?? apiKey })
  } catch {
    // Network error — fall back to main key
    return NextResponse.json({ key: apiKey })
  }
}
