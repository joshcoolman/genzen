import { cookies } from 'next/headers'
import { SESSION_COOKIE_NAME, verifySessionValue } from '../session'
import type { Session } from '../session'

// Reads identity off the request cookie inside a Server Component, Server
// Action, or route handler.
//
// This replaces the `accessToken` field that used to ride in the body of every
// server function: the caller no longer says who it is, the cookie does. That
// is the whole reason 232 `accessToken` references go away -- an argument a
// client supplies is a claim, a signed cookie the server reads is a fact.

export async function getSession(): Promise<Session | null> {
  const store = await cookies()
  return verifySessionValue(store.get(SESSION_COOKIE_NAME)?.value)
}

/**
 * The user id for the current request, or throws.
 *
 * `proxy.ts` already redirected an unauthenticated browser to /login before
 * this runs, so a throw here means a non-browser caller or a bug -- not a
 * signed-out user who deserves a friendly screen.
 */
export async function requireUserId(): Promise<string> {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  return session.userId
}
