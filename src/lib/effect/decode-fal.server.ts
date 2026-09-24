import 'server-only'
import { ContentRefused, FalRefused, FalTimeout, FalTransport } from './errors'
import { describeThrown, extractFalError } from '#/lib/server/fal-error.server'
import { isTransientNetworkError } from '#/lib/server/fal-retry.server'

export type FalFailure = FalTransport | FalTimeout | FalRefused | ContentRefused

/** Timeouts arrive under half a dozen names depending on who gave up first --
 *  undici, Node's AbortSignal, or FAL itself. */
const TIMEOUT = /timeout|timed out|aborted/i

/** A refusal about the picture rather than the request. The provider returns a
 *  422 for it, but not only for it, so the message is read too. */
const CONTENT = /content policy|safety|moderation|nsfw|refus|blocked|violat/i

function codeOf(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : ''
}

function statusOf(err: unknown): number {
  const status = (err as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : 0
}

/**
 * A thrown value from a FAL call, decoded once.
 *
 * The evidence -- a `code` buried three `cause` levels down, an HTTP status, a
 * `detail[].msg` -- only exists here. Everything downstream matches on the tag
 * instead of re-reading a string, which is what `error-classification.ts` does
 * on the client and cannot do well.
 *
 * `isTransientNetworkError` is the input rather than a second copy of its code
 * set: the list grew twice in production (#556), and a decoder with its own
 * copy would have grown only once.
 *
 * **An unrecognised failure is not retried.** Guessing costs a paid request
 * that will fail the same way, so anything the evidence does not place lands
 * as `FalRefused` with status 0.
 */
export function decodeFalError(err: unknown): FalFailure {
  const described = describeThrown(err)
  const code = codeOf(err)
  const status = statusOf(err)

  if (isTransientNetworkError(err)) {
    if (TIMEOUT.test(code) || TIMEOUT.test(described)) {
      return new FalTimeout({ message: described })
    }
    return new FalTransport({ message: described, code: code || 'unknown' })
  }

  const message = extractFalError(err).message

  if (status === 422 || CONTENT.test(message)) {
    return new ContentRefused({ message })
  }

  return new FalRefused({ message, status })
}
