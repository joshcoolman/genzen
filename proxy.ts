import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  SESSION_COOKIE_NAME,
  verifySessionValue,
} from '@/features/auth/session'

// Deny-by-default route protection. Every path is private unless it appears in
// PUBLIC_PATHS below -- the inverse of the old arrangement, where each route
// remembered to check for itself and `/` and `/login` had to redirect from the
// component because `beforeLoad` does not re-run after the server matched.
//
// This is the Next primitive TanStack Start had no equivalent of, and the
// reason #168 decided the framework up front.
//
// `session.ts` is Web Crypto only, so it is safe to import here. Never reach
// into `features/auth/server/*` from this file -- `node:crypto` does not exist
// in this runtime.

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|404.png).*)'],
}

const PUBLIC_PATHS = new Set(['/login'])

// FAL calls this one back with a signed body of its own; it carries no session
// cookie and must not be redirected to /login.
const PUBLIC_PREFIXES = ['/api/fal-webhook']

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const isSignedIn = (await verifySessionValue(cookie)) !== null

  if (!isSignedIn && !isPublic(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (isSignedIn && isPublic(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  return NextResponse.next()
}
