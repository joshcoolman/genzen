'use server'

import { fal } from '@fal-ai/client'
import { resolveAuth } from './auth.server'
import { sql } from './db.server'
import {
  markGenerationFailedWithBlob,
  processImageResult,
  processVideoResult,
} from './fal-completion.server'
import { extractFalError } from './fal-error.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

/**
 * How long a generation may stay `pending` before the app stops believing in it
 * (#327). FAL is not obliged to answer, and a row it never answers for used to
 * poll forever -- one had been pending for 26 hours, checked every five seconds
 * the whole time.
 *
 * Generous rather than tight: the cost of giving up too early is a card that
 * says failed while the picture is still coming, which is worse than waiting.
 * Video gets its own because a clip is minutes of work where a still is
 * seconds.
 */
const DEADLINE_MS = {
  ai_video: 30 * 60 * 1000,
  default: 10 * 60 * 1000,
} as const

/**
 * How long after a row fails its error detail is still worth backfilling.
 *
 * `failed` used to be in the poll's `where` with no bound at all, so every
 * failure you had ever had was re-checked against FAL on every tick, forever --
 * one HTTP call each, to re-fetch a message that was fetched the first time.
 * Backfilling is a one-shot job that occasionally needs a second attempt, not a
 * standing subscription.
 */
const BACKFILL_WINDOW = '2 minutes'

export async function checkPendingGenerations() {
  const { userId } = await resolveAuth()

  const pending = await sql<
    Array<{
      id: string
      source: string
      status: string
      request_id: string
      generation_metadata: Record<string, unknown> | null
      age_ms: number
    }>
  >`
    select id, source, status, request_id, generation_metadata,
           (extract(epoch from (now() - created_at)) * 1000)::float8 as age_ms
    from user_images
    where user_id = ${userId}
      and request_id is not null
      and (
        status = 'pending'
        or (status = 'failed'
            and updated_at > now() - ${BACKFILL_WINDOW}::interval)
      )
  `

  let completed = 0
  let failed = 0
  // Rows that entered this pass pending and left it terminal.
  const settled = new Set<string>()

  if (pending.length > 0) {
    await Promise.all(
      pending.map(async (record) => {
        const meta = record.generation_metadata ?? {}
        const falModelId =
          (meta.fal_model_id as string | undefined) ??
          (meta.model as string | undefined)
        if (!falModelId || !record.request_id) return

        // Past its deadline, a row that FAL is still sitting on -- or will not
        // talk about -- becomes a failed card rather than a permanent poll.
        const expired =
          record.status === 'pending' &&
          record.age_ms >
            (record.source === 'ai_video'
              ? DEADLINE_MS.ai_video
              : DEADLINE_MS.default)

        async function giveUp(reason: string) {
          const blob = extractFalError(null)
          blob.message = reason
          blob.stage = 'queue'
          blob.code = 'fal_timeout'
          blob.fal_request_id ??= record.request_id
          console.error(`[check-pending] record=${record.id} ${reason}`)
          await markGenerationFailedWithBlob(record.id, blob)
        }

        try {
          const status = await fal.queue.status(falModelId, {
            requestId: record.request_id,
            logs: false,
          })

          if (status.status === 'COMPLETED') {
            const result = (await fal.queue.result(falModelId, {
              requestId: record.request_id,
            })) as { data: Record<string, unknown> }

            // FAL's result shape follows the asset, not the endpoint family:
            // images arrive as `images[]`, a clip as `video.url` (#305). The
            // row already knows which it asked for.
            if (record.source === 'ai_video') {
              await processVideoResult(record.id, userId, result.data)
            } else {
              await processImageResult(record.id, userId, result.data)
            }
            completed++
            settled.add(record.id)
          } else {
            // Non-COMPLETED branch: either the row is still pending, or it's
            // already marked failed but may be missing structured error detail.
            // Re-query the queue so we can backfill the real FAL message.
            const statusStr = status.status as string
            if (statusStr !== 'IN_QUEUE' && statusStr !== 'IN_PROGRESS') {
              // Queue reported a terminal non-completed state. Fetching the
              // result typically surfaces the real FAL error in the thrown
              // body; if it doesn't throw, synthesize a generic queue blob.
              let blob
              try {
                await fal.queue.result(falModelId, {
                  requestId: record.request_id,
                })
                blob = extractFalError(null)
                blob.message = `FAL queue reported ${statusStr}`
              } catch (resultErr) {
                blob = extractFalError(resultErr)
              }
              blob.stage = 'queue'
              if (blob.code === 'unknown') blob.code = 'fal_queue'
              blob.fal_request_id ??= record.request_id
              console.error(
                `[check-pending] record=${record.id} queue=${statusStr} message=${blob.message}`,
              )
              await markGenerationFailedWithBlob(record.id, blob)
              failed++
              settled.add(record.id)
            } else if (expired) {
              // Still IN_QUEUE or IN_PROGRESS, but long past the point where
              // that is a picture on its way. FAL will not be asked again.
              await giveUp(
                `FAL was still ${statusStr.toLowerCase().replace('_', ' ')} after ${Math.round(record.age_ms / 60000)} minutes`,
              )
              failed++
              settled.add(record.id)
            }
            // IN_QUEUE / IN_PROGRESS and still within the deadline -- waiting
          }
        } catch (err) {
          // For pending records, only mark failed if FAL explicitly rejected it
          // (contains status code info), not on network/timeout errors
          const msg = err instanceof Error ? err.message : 'Unknown error'
          console.error(
            `[check-pending] Failed for record=${record.id}: ${msg}`,
          )
          if (isFalRejection(err)) {
            const blob = extractFalError(err)
            blob.stage = 'queue'
            if (blob.code === 'unknown') blob.code = 'fal_queue'
            blob.fal_request_id ??= record.request_id
            await markGenerationFailedWithBlob(record.id, blob)
            failed++
            settled.add(record.id)
          } else if (expired) {
            // Transient errors are worth retrying -- but not indefinitely. Past
            // the deadline the retries stop being optimism and start being the
            // forever-poll this whole change is about.
            await giveUp(`FAL never answered: ${msg}`)
            failed++
            settled.add(record.id)
          }
          // Otherwise leave as pending to retry on next poll
        }
      }),
    )
  } // end FAL processing block

  // What is still in flight *after* this pass, which is what tells the caller
  // whether to poll again. Counted off the rows that were pending on the way in
  // rather than `completed + failed`: those two also count a row that was
  // already failed and settled again on the backfill path.
  const stillPending = pending.filter(
    (r) => r.status === 'pending' && !settled.has(r.id),
  ).length

  return { checked: pending.length, completed, failed, pending: stillPending }
}

/** Check if the error is a definitive FAL rejection (not a transient network error) */
function isFalRejection(err: unknown): boolean {
  if (err && typeof err === 'object') {
    // FAL client errors include status codes
    const status = (err as { status?: number }).status
    if (status && status >= 400 && status < 500) return true
    const msg = err instanceof Error ? err.message : ''
    // FAL validation errors
    if (msg.includes('422') || msg.includes('400')) return true
  }
  return false
}
