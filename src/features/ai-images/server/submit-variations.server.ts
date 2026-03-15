import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { buildFalInput } from './fal-params.server'
import { requireAuth } from '@/lib/server/auth.server'
import { checkAndDeductCredits } from '@/features/credits/server/check-credits.server'

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
    } = data

    if (prompts.length === 0) throw new Error('No prompts provided')
    if (!process.env.FAL_KEY) throw new Error('FAL_KEY not set')

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

    // Re-fetch FAL image URL if not provided (expiration safety)
    let imageUrl = falImageUrl
    if (!imageUrl) {
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

    const results: Array<{ recordId: string; request_id: string }> = []

    for (let i = 0; i < prompts.length; i++) {
      const editInput = await buildFalInput({
        modelId: 'fal-ai/nano-banana-2/edit',
        prompt: prompts[i],
        aspectRatio,
        imageUrls: [imageUrl ?? ''],
        safetyLevel: 'permissive',
      })
      const { request_id } = await (fal.queue.submit as any)(
        'fal-ai/nano-banana-2/edit',
        { input: editInput },
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
