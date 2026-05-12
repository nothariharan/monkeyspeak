import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type Ring = Array<Record<string, unknown>>

/**
 * Reads the in-memory ring populated by `server.js` (same Node process as `npm run dev`).
 * Open: GET http://localhost:3000/api/b9-debug-ring
 */
export async function GET() {
  const g = globalThis as typeof globalThis & { __B9_DBG_RING__?: Ring }
  const lines = Array.isArray(g.__B9_DBG_RING__) ? g.__B9_DBG_RING__ : []
  return NextResponse.json({
    sessionId: 'b9a7e7',
    count: lines.length,
    lines,
  })
}
