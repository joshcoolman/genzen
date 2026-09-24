/**
 * What an Effect-backed server action hands the client.
 *
 * Types only, and no `effect` import -- deliberately. A client component needs
 * to read the shape of a result and match on a failure's `_tag`; it must not
 * pull the Effect runtime into the browser bundle to do it. Keeping the wire
 * contract in its own module is what makes `import type` enough on that side,
 * and it is why the Effect allowlist rule never has to except a view file.
 */

/** Every tag the error family can put on the wire, plus the catch-all. */
export type WireErrorTag =
  | 'FalTransport'
  | 'FalTimeout'
  | 'FalRefused'
  | 'ContentRefused'
  | 'ResultMalformed'
  | 'StorageFailed'
  | 'AiKeyMissing'
  | 'AiDecode'
  | 'DbError'
  | 'Unexpected'

/**
 * A failure as plain data.
 *
 * The tag is the thing worth carrying: it is what the old
 * `MISSING_AI_KEY:` marker was faking with a string prefix, and what
 * `error-classification.ts` re-derives on the client with a regex over a
 * message. `retryable` is computed on the server from the tag, so the client
 * never decides that for itself.
 */
export interface WireError {
  readonly _tag: WireErrorTag
  readonly message: string
  readonly retryable: boolean
  /** Only on `AiKeyMissing`: the variable the operator has to set. */
  readonly envVar?: string
}

export type ActionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: WireError }
