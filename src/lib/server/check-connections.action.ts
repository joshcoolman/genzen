'use server'

import { resolveAuth } from '#/lib/server/auth.server'
import { sql } from '#/lib/server/db.server'

/**
 * `connected` -- reachable. `error` -- something a person has to fix, and
 * `remedy` says what. `unset` -- an optional key that is absent, which is a
 * normal state and must not render as a failure (#406).
 */
export type ConnectionState = 'checking' | 'connected' | 'error' | 'unset'

export interface ConnectionCheck {
  label: string
  status: ConnectionState
  /** Shown beside the badge. Identity, a URL, whatever names the thing. */
  detail?: string
  /**
   * What to actually do about it. The page used to print a raw error string
   * and nothing else, which told you something was broken and not one thing
   * about fixing it (#406).
   */
  remedy?: string
  /** The provider's own words, kept under the remedy for the unknown cases. */
  error?: string
}

/**
 * Known error text to the fix for it.
 *
 * Matched on a lowercased substring, in order, so a more specific entry goes
 * first. An unmatched error still renders -- with its raw message and the
 * generic remedy -- rather than being swallowed.
 */
const REMEDIES: Array<{ match: string; remedy: string }> = [
  {
    match: 'fal_key not configured',
    remedy: 'Add FAL_KEY to .env.local and restart `pnpm dev`.',
  },
  {
    match: 'unauthorized',
    remedy: 'FAL rejected the key. Check FAL_KEY against your FAL dashboard.',
  },
  {
    match: 'forbidden',
    remedy: 'FAL rejected the key. Check FAL_KEY against your FAL dashboard.',
  },
  {
    match: 'econnrefused',
    remedy: 'Nothing is listening. Run `pnpm local:up` to start the services.',
  },
]

function remedyFor(message: string): string | undefined {
  const lower = message.toLowerCase()
  return REMEDIES.find((r) => lower.includes(r.match))?.remedy
}

async function checkDatabase(): Promise<ConnectionCheck> {
  if (!process.env.DATABASE_URL) {
    return {
      label: 'Database',
      status: 'error',
      remedy: 'Add DATABASE_URL to .env.local. `pnpm local:up` writes it.',
    }
  }
  try {
    // sql-scope-exempt: a liveness probe that reads no table, so there are no
    // rows to scope. It exists to answer "is Postgres there", nothing else.
    await sql`select 1`
    return { label: 'Database', status: 'connected', detail: 'Postgres' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return {
      label: 'Database',
      status: 'error',
      error: message,
      remedy:
        remedyFor(message) ??
        'Postgres did not answer. Check that `pnpm local:up` has run.',
    }
  }
}

/**
 * Is the FAL key good?
 *
 * **A status code, not a thrown message.** This used to ask the SDK for a
 * deliberately doomed queue lookup and read the 404 out of the exception --
 * and the SDK throws that 404 as an `Error` with an *empty* message, so no
 * pattern matched, and the page reported a red `Error` for a key that worked
 * perfectly. A status block that cries wolf on a healthy install is worse than
 * no status block, so this asks a question with an unambiguous answer.
 *
 * The pricing endpoint is the cheapest authenticated GET FAL has: it generates
 * nothing and costs nothing. 401 is the only genuine key failure; 429 means the
 * key was recognised and then rate-limited, which is still proof it is good.
 */
async function checkFal(): Promise<ConnectionCheck> {
  if (!process.env.FAL_KEY) {
    return {
      label: 'FAL',
      status: 'error',
      remedy: 'Add FAL_KEY to .env.local and restart `pnpm dev`.',
    }
  }

  try {
    const res = await fetch(
      'https://api.fal.ai/v1/models/pricing?endpoint_id=fal-ai%2Fz-image%2Fturbo',
      { headers: { Authorization: `Key ${process.env.FAL_KEY}` } },
    )

    if (res.ok || res.status === 429) {
      return { label: 'FAL', status: 'connected' }
    }
    if (res.status === 401 || res.status === 403) {
      return {
        label: 'FAL',
        status: 'error',
        error: `${res.status} ${res.statusText}`,
        remedy: 'FAL rejected the key. Check FAL_KEY in your FAL dashboard.',
      }
    }
    return {
      label: 'FAL',
      status: 'error',
      error: `${res.status} ${res.statusText}`,
      remedy: 'FAL answered, but not with a success. Try again shortly.',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return {
      label: 'FAL',
      status: 'error',
      error: message,
      remedy: remedyFor(message) ?? 'Could not reach FAL. Check the network.',
    }
  }
}

/**
 * Every check the page shows.
 *
 * Nothing here spends money or a token: FAL is a 404 lookup, Anthropic is only
 * ever "is the key set". A settings page that bills you for opening it is not a
 * settings page.
 */
export async function checkConnections(): Promise<{
  checks: Array<ConnectionCheck>
}> {
  const { userId } = await resolveAuth()

  const [database, falCheck] = await Promise.all([checkDatabase(), checkFal()])

  return {
    checks: [
      {
        label: 'Auth',
        status: 'connected',
        // Not a probe. The session is a signed cookie this request already
        // carried -- there is no round trip left to make, and inventing one
        // would be theatre.
        detail: userId.slice(0, 8),
      },
      {
        label: 'Session secret',
        ...(process.env.AUTH_SESSION_SECRET
          ? { status: 'connected' as const }
          : {
              status: 'error' as const,
              remedy:
                'Add AUTH_SESSION_SECRET to .env.local. Without it no one can sign in.',
            }),
      },
      database,
      falCheck,
      {
        label: 'Anthropic',
        // **Optional, and usually empty locally.** The app runs fine without
        // it; the features that need it fail loudly at the point of use. A red
        // badge here would be reporting the normal state as a fault.
        ...(process.env.ANTHROPIC_API_KEY
          ? { status: 'connected' as const }
          : {
              status: 'unset' as const,
              detail: 'Optional',
              remedy:
                'Prompt enhancement, variations and Describe need ANTHROPIC_API_KEY. Everything else works without it.',
            }),
      },
    ],
  }
}
