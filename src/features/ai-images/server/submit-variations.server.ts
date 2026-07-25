import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { buildFalInput } from './fal-params.server'
import { requireAuth } from '@/lib/server/auth.server'
import { uploadBufferToFal } from '@/lib/server/fal-image-upload.server'
import { getFalWebhookUrl } from '@/lib/server/fal-webhook-url.server'
import { createImageStorage } from '@/lib/image-storage'

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

    if (!process.env.FAL_KEY) throw new Error('FAL_KEY not set')

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
            source_image_id: sourceImageId, // Immutable: actual generation source
            parent_id: rootImageId, // Mutable: group parent
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
        throw new Error(`Failed to create image record: ${insertError.message}`)
      }

      results.push({ recordId: record.id, request_id })
    }

    return results
  })
