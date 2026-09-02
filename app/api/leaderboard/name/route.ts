import { NextResponse } from 'next/server'
import namor from 'namor'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  for (let attempts = 0; attempts < 100; attempts += 1) {
    const name = namor.generate()
    if (name.length <= 18) return NextResponse.json({ name })
  }

  const fallback = namor.generate({ words: 1 }).slice(0, 18).replace(/-+$/, '')
  return NextResponse.json({ name: fallback || 'monkey' })
}
