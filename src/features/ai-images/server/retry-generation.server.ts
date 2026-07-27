'use server'

import { fal } from '@fal-ai/client'
import { buildFalInput } from './fal-params.server'
import { resolveAuth } from '@/lib/server/auth.server'
import { getFalWebhookUrl } from '@/lib/server/fal-webhook-url.server'
import { uploadBufferToFal } from '@/lib/server/fal-image-upload.server'
import { createImageStorage } from '@/lib/image-storage'
import { computeFalCostCents } from '@/lib/server/compute-cost.server'
import {
  describeGenerationError,
  markGenerationFailed,
  markGenerationSubmitted,
} from '@/lib/server/create-pending-generation.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface RetryGenerationInput {
  recordId: string
}

export async function retryGeneration(data: RetryGenerationInput) {
  const { userId, supabase } = await resolveAuth()

  // Checked inside the reserved-row block below (see the note in
  // edit-image-internal.server.ts): a missing key must produce a visible
  // failed card, not a silent throw.

  // Fetch the failed record
  const { data: record, error: fetchError } = await supabase
    .from('user_images')
    .select('id, status, generation_metadata')
    .eq('id', data.recordId)
    .eq('user_id', userId)
    .eq('status', 'failed')
    .single()

  if (fetchError) {
    throw new Error('Record not found or not in failed state')
  }

  const meta = record.generation_metadata as {
    prompt?: string
    model?: string
    fal_model_id?: string
    aspect_ratio?: string
    source_image_url?: string
    reference_image_ids?: Array<string>
  }

  if (!meta.prompt || !meta.model) {
    throw new Error('Missing generation metadata — cannot retry')
  }

  // Capture after guard so TS knows these are defined inside the closure
  const prompt = meta.prompt
  const falModelId = meta.fal_model_id ?? meta.model

  const referenceUrls: Array<string> = []
  if (meta.reference_image_ids?.length) {
    const { data: refImages } = await supabase
      .from('user_images')
      .select('id, storage_path')
      .in('id', meta.reference_image_ids)
      .eq('user_id', userId)

    if (refImages?.length) {
      const storage = createImageStorage()
      const uploads = await Promise.all(
        refImages.map(async (ref) => {
          if (!ref.storage_path) return null
          const refUrl = await storage.getUrl(ref.storage_path)
          if (!refUrl) return null
          const res = await fetch(refUrl)
          const buf = await res.arrayBuffer()
          return uploadBufferToFal(buf)
        }),
      )
      referenceUrls.push(...uploads.filter((u): u is string => u !== null))
    }
  }

  const falInput = await buildFalInput({
    modelId: falModelId,
    prompt,
    aspectRatio: meta.aspect_ratio,
    ...(referenceUrls.length > 0
      ? {
          imageUrls: [
            ...(meta.source_image_url ? [meta.source_image_url] : []),
            ...referenceUrls,
          ],
        }
      : meta.source_image_url
        ? { imageUrl: meta.source_image_url }
        : {}),
    safetyLevel: 'permissive',
  })

  // A retry reuses the failed row rather than inserting a new one. Retrying is
  // "try that again", not "make another" -- a new row left the original behind
  // as a second card the user then had to clean up, and the row it left was a
  // failure, which is exactly what they were trying to be rid of.
  //
  // It still obeys the reserve-then-submit rule: the row goes back to `pending`
  // before FAL is contacted, so a retry that fails again lands back on the same
  // card rather than disappearing.
  const retryCount =
    typeof (meta as { retry_count?: number }).retry_count === 'number'
      ? (meta as { retry_count: number }).retry_count + 1
      : 1

  const { error: reserveError } = await supabase
    .from('user_images')
    .update({
      status: 'pending',
      generation_error: null,
      request_id: null,
      generation_metadata: {
        ...meta,
        // Drop the previous failure's structured blob, or Activity would show
        // the old error against a row that is running again.
        error: undefined,
        retry_count: retryCount,
        submitted_at: new Date().toISOString(),
      },
    })
    .eq('id', data.recordId)
    .eq('user_id', userId)

  if (reserveError) {
    throw new Error(`Failed to reset record for retry: ${reserveError.message}`)
  }

  const newRecord = { id: data.recordId }

  try {
    if (!process.env.FAL_KEY) {
      throw new Error(
        'FAL_KEY is not set — add it to .env.local and restart the dev server',
      )
    }
    const webhookUrl = getFalWebhookUrl()
    const { request_id } = await (fal.queue.submit as any)(falModelId, {
      input: falInput,
      ...(webhookUrl ? { webhookUrl } : {}),
    })
    const estimatedCostCents = await computeFalCostCents(falModelId, {
      aspectRatio: meta.aspect_ratio,
    }).catch(() => null)
    await markGenerationSubmitted(
      newRecord.id,
      request_id,
      estimatedCostCents != null
        ? { estimated_cost_cents: estimatedCostCents }
        : undefined,
    )
  } catch (err) {
    console.error('[retry] generation failed', newRecord.id, err)
    await markGenerationFailed(
      newRecord.id,
      describeGenerationError(err, 'Retry failed'),
    )
    throw err
  }

  return { recordId: newRecord.id }
}
