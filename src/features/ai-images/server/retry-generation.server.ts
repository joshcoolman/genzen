import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { buildFalInput } from './fal-params.server'
import { requireAuth } from '@/lib/server/auth.server'
import { getFalWebhookUrl } from '@/lib/server/fal-webhook-url.server'
import { uploadBufferToFal } from '@/lib/server/fal-image-upload.server'
import { createImageStorage } from '@/lib/image-storage'
import {
  describeGenerationError,
  markGenerationFailed,
  markGenerationSubmitted,
} from '@/lib/server/create-pending-generation.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface RetryGenerationInput {
  accessToken: string
  recordId: string
}

export const retryGeneration = createServerFn({ method: 'POST' })
  .inputValidator((data: RetryGenerationInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    // Checked inside the reserved-row block below (see the note in
    // edit-image-internal.server.ts): a missing key must produce a visible
    // failed card, not a silent throw.

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    // Fetch the failed record
    const { data: record, error: fetchError } = await supabase
      .from('user_images')
      .select('id, status, generation_metadata')
      .eq('id', data.recordId)
      .eq('user_id', user.id)
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
        .eq('user_id', user.id)

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

    // A retry is a generation, so it obeys the same rule: reserve the row
    // first, then submit. A retry that fails again leaves its own failed
    // card rather than disappearing.
    const { data: newRecord, error: insertError } = await supabase
      .from('user_images')
      .insert({
        user_id: user.id,
        status: 'pending',
        source: 'ai_generated',
        title: 'Generating...',
        sort_order: Date.now() / 1000,
        generation_metadata: {
          ...meta,
          retried_from: data.recordId,
          submitted_at: new Date().toISOString(),
        },
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create retry record: ${insertError.message}`)
    }

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
      await markGenerationSubmitted(newRecord.id, request_id)
    } catch (err) {
      console.error('[retry] generation failed', newRecord.id, err)
      await markGenerationFailed(
        newRecord.id,
        describeGenerationError(err, 'Retry failed'),
      )
      throw err
    }

    return { recordId: newRecord.id }
  })
