import { NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME } from '#/features/auth/session'

/**
 * Clears the session cookie and returns to /login.
 *
 * The sidebar signs out through a Server Action; this exists for the case an
 * action cannot handle -- a Server Component that has already started
 * rendering discovers the session is unusable and needs to *clear* it on the
 * way out. `redirect('/login')` alone would leave the bad cookie in place, and
 * `proxy.ts` would bounce the request straight back.
 */
export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/login', request.url))
  response.cookies.delete(SESSION_COOKIE_NAME)
  return response
}
