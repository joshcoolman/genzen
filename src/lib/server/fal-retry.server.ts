import 'server-only'
import { describeThrown } from './fal-error.server'

/**
 * A pooled connection that died is not a failed request (#556).
 *
 * Node 26 ships undici 8, which pools **HTTP/2 sessions**. When one is
 * destroyed -- a GOAWAY, an idle timeout, anything the far end decides -- the
 * session can stay in the pool, and every request dispatched onto it throws
 * `ERR_HTTP2_INVALID_SESSION` under Node's uniform "fetch failed". A long-lived
 * server therefore stops being able to reach FAL at all while a freshly started
 * process on the same machine talks to it fine: that is exactly what happened,
 * a dev server up for eight hours against a script that worked first try.
 *
 * A retry is the fix rather than a papering-over, because the second attempt
 * opens a new session. It also covers the ordinary resets and timeouts that
 * were always possible and were always reported as a generation failure.
 *
 * **Only genuinely transient transport failures are retried.** A 4xx from FAL,
 * a bad prompt, an unreadable object -- all of those come back on the first
 * attempt, because retrying them would spend money on a request that will fail
 * the same way.
 */
const TRANSIENT_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'EPROTO',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
])

/**
 * Whole families, because listing individual codes is how the first pass missed
 * the second failure. `ERR_HTTP2_*` covers the destroyed session and every
 * other way a multiplexed stream dies; `ERR_SSL_*` / `ERR_TLS_*` cover a
 * corrupted TLS record, which arrived as "ssl3_read_bytes:tls alert bad record
 * mac" the day after the HTTP/2 one and was not retried because this listed
 * codes rather than kinds.
 */
const TRANSIENT_CODE_PREFIXES = ['ERR_HTTP2_', 'ERR_SSL_', 'ERR_TLS_']

const TRANSIENT_MESSAGES =
  /session has been destroyed|socket hang up|other side closed|terminated|bad record mac|decryption failed|tls alert|tlsv1 alert|ssl3_read_bytes|EPROTO/i

export function isTransientNetworkError(error: unknown, depth = 4): boolean {
  let current: unknown = error
  for (let i = 0; i <= depth && current; i++) {
    const record = current as {
      code?: unknown
      message?: unknown
      cause?: unknown
    }
    if (typeof record.code === 'string') {
      const code = record.code
      if (TRANSIENT_CODES.has(code)) return true
      if (TRANSIENT_CODE_PREFIXES.some((p) => code.startsWith(p))) return true
    }
    if (
      typeof record.message === 'string' &&
      TRANSIENT_MESSAGES.test(record.message)
    ) {
      return true
    }
    if (record.cause === current) break
    current = record.cause
  }
  return false
}

/** Run `attempt`, retrying only a dead-transport failure. Returns the first
 *  success; rethrows the last error when every attempt hits one. */
export async function withNetworkRetry<T>(
  label: string,
  attempt: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown
  for (let n = 1; n <= attempts; n++) {
    try {
      return await attempt()
    } catch (error) {
      if (!isTransientNetworkError(error)) throw error
      lastError = error
      if (n === attempts) break
      console.warn(
        `[fal] ${label}: transient transport failure on attempt ${n}, retrying -- ${describeThrown(error)}`,
      )
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (n - 1)))
    }
  }
  throw lastError
}
