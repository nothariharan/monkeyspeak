import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/** Pass-through with basic security headers (API routes excluded from matcher). */
export function middleware(_request: NextRequest) {
  const res = NextResponse.next()
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https: wss: ws:; media-src 'self' blob:; worker-src 'self' blob:; frame-ancestors 'none'"
  )
  return res
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)'],
}
