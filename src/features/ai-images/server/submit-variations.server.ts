import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { buildFalInput } from './fal-params.server'
import { requireAuth } from '@/lib/server/auth.server'
import { checkAndDeductCredits } from '@/features/credits/server/check-credits.server'
import { uploadBufferToFal } from '@/lib/server/fal-image-upload.server'
import { getFalWebhookUrl } from '@/lib/server/fal-webhook-url.server'
import { isGoogleProvider, submitGeneration } from '@/lib/server/media.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

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

    const useGoogle = isGoogleProvider('fal-ai/nano-banana-2/edit')

    if (!useGoogle && !process.env.FAL_KEY) throw new Error('FAL_KEY not set')

    // Deduct credits atomically
    const creditResult = await checkAndDeductCredits(
      data.accessToken,
      'variation',
      prompts.length,
    )
    if (!creditResult.allowed) throw new Error('Insufficient credits')

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    // For Google path, we need base64 of the root image
    let imageBase64ForGoogle: string | undefined
    // For FAL path, we need a FAL URL
    let imageUrl = falImageUrl

    if (useGoogle) {
      // Fetch root image as base64 for Google API
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
        const { data: signed } = await supabase.storage
          .from('user-images')
          .createSignedUrl(rootImage.storage_path, 3600)
        if (signed?.signedUrl) {
          const imageRes = await fetch(signed.signedUrl)
          const buffer = await imageRes.arrayBuffer()
          imageBase64ForGoogle = Buffer.from(buffer).toString('base64')
        }
      }
    } else if (!imageUrl) {
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
        const { data: signed } = await supabase.storage
          .from('user-images')
          .createSignedUrl(rootImage.storage_path, 3600)
        if (signed?.signedUrl) {
          const imageRes = await fetch(signed.signedUrl)
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

    // Fetch and upload reference images in parallel (FAL only)
    const referenceUrls: Array<string> = []
    if (!useGoogle && referenceImageIds?.length) {
      const refImages = await supabase
        .from('user_images')
        .select('id, storage_path')
        .in('id', referenceImageIds)
        .eq('user_id', user.id)

      if (refImages.data?.length) {
        const uploads = await Promise.all(
          refImages.data.map(async (ref) => {
            if (!ref.storage_path) return null
            const { data: signed } = await supabase.storage
              .from('user-images')
              .createSignedUrl(ref.storage_path, 3600)
            if (!signed?.signedUrl) return null
            const res = await fetch(signed.signedUrl)
            const buf = await res.arrayBuffer()
            return uploadBufferToFal(buf)
          }),
        )
        referenceUrls.push(...uploads.filter((u): u is string => u !== null))
      }
    }

    const results: Array<{ recordId: string; request_id?: string }> = []

    for (let i = 0; i < prompts.length; i++) {
      if (useGoogle) {
        // Google path: synchronous generation
        const result = await submitGeneration({
          accessToken: data.accessToken,
          userId: user.id,
          prompt: prompts[i],
          modelId: 'fal-ai/nano-banana-2/edit',
          aspectRatio,
          imageBase64: imageBase64ForGoogle,
          metadata: {
            original_prompt: rootPrompt,
            generation_type: 'variation',
            source_image_id: sourceImageId,
            root_image_id: rootImageId,
            ...(referenceImageIds?.length
              ? { reference_image_ids: referenceImageIds }
              : {}),
          },
        })

        results.push({
          recordId: result.recordId,
          request_id: result.request_id,
        })
      } else {
        // FAL path: async queue
        const editInput = await buildFalInput({
          modelId: 'fal-ai/nano-banana-2/edit',
          prompt: prompts[i],
          aspectRatio,
          imageUrls: [imageUrl ?? '', ...referenceUrls],
          safetyLevel: 'permissive',
        })
        const webhookUrl = getFalWebhookUrl()

        const { request_id } = await (fal.queue.submit as any)(
          'fal-ai/nano-banana-2/edit',
          {
            input: editInput,
            ...(webhookUrl ? { webhookUrl } : {}),
          },
        )

        const variationSortOrder = Date.now() / 1000 - 0.001 * (i + 1)

        const { data: record, error: insertError } = await supabase
          .from('user_images')
          .insert({
            user_id: user.id,
            request_id,
            status: 'pending',
            source: 'ai_generated',
            title: 'Generating variation...',
            sort_order: variationSortOrder,
            generation_metadata: {
              prompt: prompts[i],
              original_prompt: rootPrompt,
              model,
              fal_model_id: 'fal-ai/nano-banana-2/edit',
              generation_type: 'variation',
              source_image_id: sourceImageId,
              root_image_id: rootImageId,
              submitted_at: new Date().toISOString(),
              ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
              ...(referenceImageIds?.length
                ? { reference_image_ids: referenceImageIds }
                : {}),
            },
          })
          .select()
          .single()

        if (insertError) {
          throw new Error(
            `Failed to create image record: ${insertError.message}`,
          )
        }

        results.push({ recordId: record.id, request_id })
      }
    }

    return results
  })
