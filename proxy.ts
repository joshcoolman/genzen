import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  SESSION_COOKIE_NAME,
  verifySessionValue,
} from '#/features/auth/session'

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

/**
 * Reachable without a session.
 *
 * `/api/auth/sign-out` is here so a cookie that verifies but names a user who
 * no longer exists can still be cleared -- see SIGNED_OUT_ONLY_PATHS.
 */
const PUBLIC_PATHS = new Set(['/login', '/api/auth/sign-out'])

// FAL calls this one back with a signed body of its own; it carries no session
// cookie and must not be redirected to /login.
const PUBLIC_PREFIXES = ['/api/fal-webhook']

/**
 * Public paths a signed-in user is bounced away from. Deliberately narrower
 * than PUBLIC_PATHS: bouncing every public path meant a signed-in user could
 * not reach sign-out, and the webhook could not be delivered.
 *
 * This split is what closes a redirect loop. `proxy.ts` only checks that the
 * cookie's signature is valid; the dashboard layout additionally requires the
 * user row to exist. When those two disagreed -- a valid cookie naming a
 * deleted user -- the layout sent you to /login and this file sent you straight
 * back, forever. Now the layout sends you to /api/auth/sign-out, which clears
 * the cookie and makes the two agree.
 */
const SIGNED_OUT_ONLY_PATHS = new Set(['/login'])

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
  if (isSignedIn && SIGNED_OUT_ONLY_PATHS.has(pathname)) {
    return NextResponse.redirect(new URL('/images', request.url))
  }
  return NextResponse.next()
}
