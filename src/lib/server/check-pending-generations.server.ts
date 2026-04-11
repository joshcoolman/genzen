import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { requireAuth } from './auth.server'
import { getSupabaseAdmin } from './supabase-admin.server'
import {
  markGenerationFailedWithBlob,
  processImageResult,
  processVideoResult,
} from './fal-completion.server'
import { extractFalError } from './fal-error.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface CheckPendingInput {
  accessToken: string
}

export const checkPendingGenerations = createServerFn({ method: 'POST' })
  .inputValidator((data: CheckPendingInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)
    const supabase = getSupabaseAdmin()

    // Fetch pending records + recently failed records that might have completed on FAL
    const { data: pending, error: queryError } = (await supabase
      .from('user_images')
      .select('id, source, status, request_id, generation_metadata')
      .eq('user_id', user.id)
      .in('status', ['pending', 'failed'])
      .not('request_id', 'is', null)) as {
      data: Array<{
        id: string
        source: string
        status: string
        request_id: string
        generation_metadata: Record<string, unknown> | null
      }> | null
      error: { message: string } | null
    }

    if (queryError || !pending || pending.length === 0) {
      return { checked: 0, completed: 0, failed: 0 }
    }

    let completed = 0
    let failed = 0

    await Promise.all(
      pending.map(async (record) => {
        const meta = record.generation_metadata ?? {}
        const falModelId =
          (meta.fal_model_id as string | undefined) ??
          (meta.model as string | undefined)
        if (!falModelId || !record.request_id) return

        try {
          const status = await fal.queue.status(falModelId, {
            requestId: record.request_id,
            logs: false,
          })

          if (status.status === 'COMPLETED') {
            const result = (await fal.queue.result(falModelId, {
              requestId: record.request_id,
            })) as { data: Record<string, unknown> }

            const isVideo = record.source === 'ai_video'
            if (isVideo) {
              await processVideoResult(supabase, record.id, result.data)
            } else {
              await processImageResult(
                supabase,
                record.id,
                user.id,
                result.data,
              )
            }
            completed++
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
              await markGenerationFailedWithBlob(supabase, record.id, blob)
              failed++
            }
            // IN_QUEUE / IN_PROGRESS — still waiting, skip
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
            await markGenerationFailedWithBlob(supabase, record.id, blob)
            failed++
          }
          // Otherwise leave as pending to retry on next poll
        }
      }),
    )

    return { checked: pending.length, completed, failed }
  })

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
