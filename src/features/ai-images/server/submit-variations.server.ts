import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { buildFalInput } from './fal-params.server'
import { requireAuth } from '@/lib/server/auth.server'
import { uploadBufferToFal } from '@/lib/server/fal-image-upload.server'
import { getFalWebhookUrl } from '@/lib/server/fal-webhook-url.server'
import { createImageStorage } from '@/lib/image-storage'
import { computeFalCostCents } from '@/lib/server/compute-cost.server'
import {
  createPendingGeneration,
  describeGenerationError,
  markGenerationFailed,
  markGenerationSubmitted,
} from '@/lib/server/create-pending-generation.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

const VARIATION_EDIT_MODEL = 'fal-ai/nano-banana-2/edit'

interface SubmitVariationsInput {
  accessToken: string
  prompts: Array<string>
  model: string
  sourceImageId: string
  rootImageId: string
  rootPrompt: string
  aspectRatio?: string
  falImageUrl?: string
  referenceImageIds?: Array<string>
}

export const submitVariations = createServerFn({ method: 'POST' })
  .inputValidator((data: SubmitVariationsInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)
    const {
      prompts,
      model,
      sourceImageId,
      rootImageId,
      rootPrompt,
      aspectRatio,
      falImageUrl,
      referenceImageIds,
    } = data

    if (prompts.length === 0) throw new Error('No prompts provided')

    // NOTE: the FAL_KEY check deliberately does NOT live here — see the note in
    // edit-image-internal.server.ts. It runs inside the reserved-row try block.

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    let imageUrl = falImageUrl

    const storage = createImageStorage()

    if (!imageUrl) {
      // Re-fetch FAL image URL if not provided (expiration safety)
      if (!/^[0-9a-f-]{36}$/i.test(rootImageId)) {
        throw new Error('Invalid rootImageId')
      }
      const { data: rootImage } = await supabase
        .from('user_images')
        .select('storage_path')
        .eq('id', rootImageId)
        .eq('user_id', user.id)
        .single()
      if (rootImage?.storage_path) {
        const signedUrl = await storage.getUrl(rootImage.storage_path)
        if (signedUrl) {
          const imageRes = await fetch(signedUrl)
          const buffer = await imageRes.arrayBuffer()
          const bytes = new Uint8Array(buffer)
          let mediaType = 'image/jpeg'
          if (
            bytes[0] === 0x89 &&
            bytes[1] === 0x50 &&
            bytes[2] === 0x4e &&
            bytes[3] === 0x47
          ) {
            mediaType = 'image/png'
          } else if (
            bytes[0] === 0x52 &&
            bytes[1] === 0x49 &&
            bytes[2] === 0x46 &&
            bytes[3] === 0x46
          ) {
            mediaType = 'image/webp'
          }
          imageUrl = await fal.storage.upload(
            new Blob([buffer], { type: mediaType }),
          )
        }
      }
    }

    // Fetch and upload reference images in parallel
    const referenceUrls: Array<string> = []
    if (referenceImageIds?.length) {
      const refImages = await supabase
        .from('user_images')
        .select('id, storage_path')
        .in('id', referenceImageIds)
        .eq('user_id', user.id)

      if (refImages.data?.length) {
        const uploads = await Promise.all(
          refImages.data.map(async (ref) => {
            if (!ref.storage_path) return null
            const refSignedUrl = await storage.getUrl(ref.storage_path)
            if (!refSignedUrl) return null
            const res = await fetch(refSignedUrl)
            const buf = await res.arrayBuffer()
            return uploadBufferToFal(buf)
          }),
        )
        referenceUrls.push(...uploads.filter((u): u is string => u !== null))
      }
    }

    const results: Array<{ recordId: string; request_id?: string }> = []

    for (let i = 0; i < prompts.length; i++) {
      // Reserve BEFORE the FAL submit, so a rejected prompt or a missing key
      // still leaves a failed card with a reason and a Retry.
      const { recordId } = await createPendingGeneration({
        accessToken: data.accessToken,
        userId: user.id,
        generationType: 'variation',
        falModelId: VARIATION_EDIT_MODEL,
        prompt: prompts[i],
        aspectRatio,
        title: 'Generating variation...',
        sortOrder: Date.now() / 1000 - 0.001 * (i + 1),
        extraMetadata: {
          model,
          original_prompt: rootPrompt,
          source_image_id: sourceImageId, // Immutable: actual generation source
          parent_id: rootImageId, // Mutable: group parent
          root_image_id: rootImageId,
          ...(referenceImageIds?.length
            ? { reference_image_ids: referenceImageIds }
            : {}),
        },
      })

      try {
        results.push({ recordId, request_id: await submitOne(prompts[i]) })
      } catch (err) {
        // One prompt failing must not cancel the rest of the batch.
        console.error('[submit-variations] generation failed', recordId, err)
        await markGenerationFailed(
          recordId,
          describeGenerationError(err, 'Variation failed'),
        )
        results.push({ recordId })
      }

      async function submitOne(promptText: string) {
        if (!process.env.FAL_KEY) {
          throw new Error(
            'FAL_KEY is not set — add it to .env.local and restart the dev server',
          )
        }

        const editInput = await buildFalInput({
          modelId: VARIATION_EDIT_MODEL,
          prompt: promptText,
          aspectRatio,
          imageUrls: [imageUrl ?? '', ...referenceUrls],
          safetyLevel: 'permissive',
        })
        const webhookUrl = getFalWebhookUrl()

        const { request_id } = await (fal.queue.submit as any)(
          VARIATION_EDIT_MODEL,
          {
            input: editInput,
            ...(webhookUrl ? { webhookUrl } : {}),
          },
        )

        const estimatedCostCents = await computeFalCostCents(
          VARIATION_EDIT_MODEL,
          { aspectRatio },
        ).catch(() => null)

        await markGenerationSubmitted(
          recordId,
          request_id,
          estimatedCostCents != null
            ? { estimated_cost_cents: estimatedCostCents }
            : undefined,
        )

        return request_id as string
      }
    }

    return results
  })
