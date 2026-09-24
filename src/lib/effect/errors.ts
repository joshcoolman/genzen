import { Match, Schema } from 'effect'
import type { WireError, WireErrorTag } from './result'

/**
 * The failure family, in one place.
 *
 * The app had already hand-written most of this, one outage at a time and in
 * four different shapes: `fal-retry.server.ts` decides what to retry from a
 * code set, `fal-error.server.ts` walks a `cause` chain into a blob,
 * `error-classification.ts` re-derives the same verdict on the client with a
 * regex over a message, and `ai-keys.ts` smuggles "no key" across the RPC
 * boundary as a string prefix. Each one answers a slice of the same question --
 * retry, refuse, or mark failed -- and none of them can see the others.
 *
 * A tagged error answers it once. The tag is decided at the boundary where the
 * evidence actually exists (the FAL response, the model call, the query), and
 * every decision after that is a match on the tag rather than another guess at
 * a string.
 *
 * `NeverSubmitted` is not here on purpose: the only thing that can observe it
 * is `submitFalOnce`, which is queue-based generation and out of scope for
 * News. It belongs with that call when the allowlist grows to cover it, not as
 * a class nothing can construct.
 */

/** The transport died -- a reset socket, a destroyed HTTP/2 session, a TLS
 *  record that did not decode. Worth retrying; the next attempt opens a new
 *  connection. See `fal-retry.server.ts` for why this is a whole family. */
export class FalTransport extends Schema.TaggedError<FalTransport>()(
  'FalTransport',
  { message: Schema.String, code: Schema.String },
) {}

/** The request ran out of time rather than failing. Retryable for the same
 *  reason, and separate from `FalTransport` because a run of these means the
 *  endpoint is slow, not that the network is broken. */
export class FalTimeout extends Schema.TaggedError<FalTimeout>()('FalTimeout', {
  message: Schema.String,
}) {}

/** FAL said no: a 4xx that is not a content judgement. Bad input, bad
 *  endpoint, bad key. Retrying spends money on the same answer. */
export class FalRefused extends Schema.TaggedError<FalRefused>()('FalRefused', {
  message: Schema.String,
  status: Schema.Number,
}) {}

/** The provider refused on content grounds. Distinguished from `FalRefused`
 *  because it is the one refusal a human can act on by rewording, and because
 *  it arrives late -- `queue.status` answers COMPLETED and the 422 only shows
 *  up when the result is fetched (#697). */
export class ContentRefused extends Schema.TaggedError<ContentRefused>()(
  'ContentRefused',
  { message: Schema.String },
) {}

/** The call succeeded and the payload was not the shape we asked for -- no
 *  `images[0].url`, an empty array. Not a network problem and not a refusal, so
 *  it used to read as `return null` and vanish. */
export class ResultMalformed extends Schema.TaggedError<ResultMalformed>()(
  'ResultMalformed',
  { message: Schema.String },
) {}

/** Pulling the provider's asset into our own bucket failed. Its own tag
 *  because the bytes exist and were paid for: this is the one failure where
 *  retrying the *storage* step, not the generation, is the right move. */
export class StorageFailed extends Schema.TaggedError<StorageFailed>()(
  'StorageFailed',
  { message: Schema.String },
) {}

/** The provider key the action needs is not set. Replaces the `MISSING_AI_KEY:`
 *  message marker for anything running through `runAction`. */
export class AiKeyMissing extends Schema.TaggedError<AiKeyMissing>()(
  'AiKeyMissing',
  { provider: Schema.String, envVar: Schema.String, message: Schema.String },
) {}

/** The model answered and the answer did not fit the schema, or the call itself
 *  threw. One tag, because from the caller's side both mean "no usable
 *  output from the model". */
export class AiDecode extends Schema.TaggedError<AiDecode>()('AiDecode', {
  message: Schema.String,
}) {}

/** A query failed. */
export class DbError extends Schema.TaggedError<DbError>()('DbError', {
  label: Schema.String,
  message: Schema.String,
}) {}

export type GenzenError =
  | FalTransport
  | FalTimeout
  | FalRefused
  | ContentRefused
  | ResultMalformed
  | StorageFailed
  | AiKeyMissing
  | AiDecode
  | DbError

/**
 * Retry or not, decided from the tag alone.
 *
 * This is the whole reason the family exists. `isRetryable` in
 * `error-classification.ts` is a regex over a message string running in the
 * browser -- it can only guess, and it guesses after the moment a retry would
 * have helped. Here the evidence was read once, at the boundary, and the
 * answer is exhaustive: a new member of the family will not compile until it
 * says which side it is on.
 */
export const isRetryable: (error: GenzenError) => boolean =
  Match.type<GenzenError>().pipe(
    Match.tag('FalTransport', 'FalTimeout', () => true),
    Match.tag(
      'FalRefused',
      'ContentRefused',
      'ResultMalformed',
      'AiKeyMissing',
      'AiDecode',
      'DbError',
      () => false,
    ),
    // A failed upload is worth another attempt: the asset exists and has been
    // paid for, and the failure is our bucket rather than the provider.
    Match.tag('StorageFailed', () => true),
    Match.exhaustive,
  )

/** The failure as plain data, for the wire. A class instance does not survive
 *  the server-action boundary intact, and the client only ever needs the tag,
 *  a sentence, and the verdict. */
export function toWire(error: GenzenError): WireError {
  return {
    _tag: error._tag satisfies WireErrorTag,
    message: error.message,
    retryable: isRetryable(error),
    ...(error._tag === 'AiKeyMissing' ? { envVar: error.envVar } : {}),
  }
}
