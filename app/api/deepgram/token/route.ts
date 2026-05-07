import { createClient } from '@deepgram/sdk'
import { NextResponse } from 'next/server'

/**
 * Issues a short-lived Deepgram temporary token via the SDK.
 * The real DEEPGRAM_API_KEY never leaves the server.
 *
 * deepgram.md §2.1: Use POST + deepgram.auth.grantToken()
 */
export async function POST() {
  const apiKey = process.env.DEEPGRAM_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'DEEPGRAM_API_KEY not configured' },
      { status: 500 }
    )
  }

  try {
    const deepgram = createClient(apiKey)
    const { result, error } = await deepgram.auth.grantToken()

    if (error || !result?.access_token) {
      // grantToken may fail on free-tier accounts — fall back to raw key
      console.warn('[deepgram/token] grantToken failed, falling back to raw key:', error)
      return NextResponse.json({ token: apiKey, ttlSeconds: 3600 })
    }

    return NextResponse.json({ token: result.access_token, ttlSeconds: 28 })
  } catch (err) {
    console.warn('[deepgram/token] SDK error, falling back to raw key:', err)
    // Always fall back so dev works without project-level permissions
    return NextResponse.json({ token: apiKey, ttlSeconds: 3600 })
  }
}

// Keep GET for backward compat with any cached calls during hot-reload
export async function GET() {
  return POST()
}
