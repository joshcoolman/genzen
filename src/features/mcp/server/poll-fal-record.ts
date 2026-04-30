import { fal } from '@fal-ai/client'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin.server'
import {
  markGenerationFailedWithBlob,
  processImageResult,
  processVideoResult,
} from '@/lib/server/fal-completion.server'
import { extractFalError } from '@/lib/server/fal-error.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface PendingRecord {
  id: string
  user_id: string
  source: string
  request_id: string
  generation_metadata: Record<string, unknown> | null
}

/**
 * Polls FAL for a single pending record and updates the user_images row
 * if the job has completed or failed. Used by the MCP path's
 * waitForGeneration loop because nothing else polls FAL on that path —
 * the browser path relies on `checkPendingGenerations` being called
 * periodically by the UI hooks.
 *
 * Returns true if the row was flipped (caller can re-query DB to read
 * the new state), false if still pending or polling itself failed.
 */
export async function pollFalRecord(recordId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { data: record, error } = (await supabase
    .from('user_images')
    .select('id, user_id, source, status, request_id, generation_metadata')
    .eq('id', recordId)
    .maybeSingle()) as {
    data: (PendingRecord & { status: string }) | null
    error: { message: string } | null
  }

  if (error || !record) return false
  if (record.status !== 'pending') return false
  if (!record.request_id) return false

  const meta = record.generation_metadata ?? {}
  const falModelId =
    (meta.fal_model_id as string | undefined) ??
    (meta.model as string | undefined)
  if (!falModelId) return false

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
          record.user_id,
          result.data,
        )
      }
      return true
    }

    const statusStr = status.status as string
    if (statusStr !== 'IN_QUEUE' && statusStr !== 'IN_PROGRESS') {
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
      await markGenerationFailedWithBlob(supabase, record.id, blob)
      return true
    }

    return false
  } catch {
    // Transient errors (network, timeout) — leave as pending and retry
    // on the next iteration. Don't mark as failed here.
    return false
  }
}
