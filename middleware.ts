import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/** Pass-through — ensures middleware manifest is always part of the dev graph on Windows. */
export function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)'],
}
