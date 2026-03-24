import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { generateText } from 'ai'
import { buildFalInput } from './fal-params.server'
import { requireAuth } from '@/lib/server/auth.server'
import { checkAndDeductCredits } from '@/features/credits/server/check-credits.server'
import { ai } from '@/lib/server/ai.server'
import {
  IMAGE_VARIATION_SYSTEM,
  variationUserContent,
} from '@/lib/prompts/image-variation'
import { isGoogleProvider, submitGeneration } from '@/lib/server/media.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface GenerateVariationInput {
  accessToken: string
  prompt: string
  model: string
  sourceImageId: string
  count?: number
  aspectRatio?: string
}

export const generateVariation = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateVariationInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    const { prompt, model, sourceImageId, aspectRatio } = data
    const variationCount = Math.min(data.count ?? 1, 4)

    if (!prompt.trim()) {
      throw new Error('Prompt is required')
    }

    const useGoogle = isGoogleProvider('fal-ai/nano-banana-2/edit')

    if (!useGoogle && !process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    // Deduct credits for all variations atomically
    const creditResult = await checkAndDeductCredits(
      data.accessToken,
      'variation',
      variationCount,
    )
    if (!creditResult.allowed) {
      throw new Error('Insufficient credits')
    }

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    // Validate sourceImageId is a UUID before using in filter strings
    if (!/^[0-9a-f-]{36}$/i.test(sourceImageId)) {
      throw new Error('Invalid sourceImageId')
    }

    // Fetch the source image's sort_order and storage_path — enforce ownership
    const { data: sourceImage } = await supabase
      .from('user_images')
      .select('sort_order, storage_path, generation_metadata')
      .eq('id', sourceImageId)
      .eq('user_id', user.id)
      .single()

    // If the source is itself a variation, use the root original prompt instead of the
    // variation's prompt. This prevents the "creative tension" from collapsing when Claude
    // sees an image that perfectly matches the prompt it's given.
    const sourceMetadata = sourceImage?.generation_metadata as Record<
      string,
      unknown
    > | null
    const rootPrompt =
      sourceMetadata?.generation_type === 'variation' &&
      typeof sourceMetadata.original_prompt === 'string'
        ? sourceMetadata.original_prompt
        : prompt

    // Compute root image ID — the original image that started this variation family
    const rootImageId =
      typeof sourceMetadata?.root_image_id === 'string'
        ? sourceMetadata.root_image_id
        : sourceMetadata?.generation_type === 'variation' &&
            typeof sourceMetadata.source_image_id === 'string'
          ? sourceMetadata.source_image_id
          : sourceImageId

    // Use root image for FAL instead of immediate parent to prevent quality drift
    let imageStoragePath = sourceImage?.storage_path
    if (rootImageId !== sourceImageId) {
      const { data: rootImage } = await supabase
        .from('user_images')
        .select('storage_path')
        .eq('id', rootImageId)
        .eq('user_id', user.id)
        .single()
      if (rootImage?.storage_path) {
        imageStoragePath = rootImage.storage_path
      }
      // If root is gone, fall back to sourceImage's storage_path (already set)
    }

    const signedUrl = imageStoragePath
      ? (
          await supabase.storage
            .from('user-images')
            .createSignedUrl(imageStoragePath, 3600)
        ).data?.signedUrl
      : undefined

    // Fetch image bytes — needed for both Claude (base64) and FAL (upload to get HTTPS URL)
    let imageBase64:
      | {
          data: string
          mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
        }
      | undefined
    let falImageUrl: string | undefined
    if (signedUrl) {
      try {
        const imageRes = await fetch(signedUrl)
        const buffer = await imageRes.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        // Detect actual format from magic bytes — don't trust Content-Type header
        let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' =
          'image/jpeg'
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
        imageBase64 = {
          data: Buffer.from(buffer).toString('base64'),
          mediaType,
        }
        // Upload to FAL storage only if not using Google
        if (!useGoogle) {
          falImageUrl = await fal.storage.upload(
            new Blob([buffer], { type: mediaType }),
          )
        }
      } catch {
        // proceed without vision grounding if fetch or upload fails
      }
    }

    // Fetch all existing variation prompts in this family so Claude can avoid repeats.
    // Prefer root_image_id filter; fall back to source_image_id for older variations.
    const { data: existingVariations } = await supabase
      .from('user_images')
      .select('generation_metadata')
      .eq('user_id', user.id)
      .filter('generation_metadata->>generation_type', 'eq', 'variation')
      .or(
        `generation_metadata->>root_image_id.eq.${rootImageId},generation_metadata->>source_image_id.eq.${rootImageId},generation_metadata->>source_image_id.eq.${sourceImageId}`,
      )
      .limit(20)
    const usedPrompts = (existingVariations ?? [])
      .map((v) => (v.generation_metadata as Record<string, unknown>).prompt)
      .filter((p): p is string => typeof p === 'string')
    // Always include the source image's own prompt — this is the scene Claude is looking at,
    // so it must be explicitly told NOT to reproduce it
    const sourcePrompt =
      typeof sourceMetadata?.prompt === 'string'
        ? sourceMetadata.prompt
        : prompt
    if (!usedPrompts.includes(sourcePrompt)) {
      usedPrompts.unshift(sourcePrompt)
    }

    const count = Math.min(data.count ?? 1, 4)
    const results: Array<{ recordId: string; request_id?: string }> = []

    for (let i = 0; i < count; i++) {
      // usedPrompts grows each iteration — each new prompt is appended after generation
      const avoidSection =
        usedPrompts.length > 0
          ? `\n\nALREADY GENERATED (avoid similar shots):\n${usedPrompts.map((p, idx) => `${idx + 1}. ${p}`).join('\n')}`
          : ''

      const userContent = variationUserContent({
        avoidSection,
        hasImage: !!imageBase64,
        imageBase64,
        rootPrompt,
      })

      const response = await generateText({
        model: ai.reasoning,
        maxOutputTokens: 300,
        system: IMAGE_VARIATION_SYSTEM,
        messages: [{ role: 'user', content: userContent }],
      })

      const variedPrompt = response.text.trim()
      usedPrompts.push(variedPrompt)

      const variationSortOrder = Date.now() / 1000 - 0.001 * (i + 1)

      if (useGoogle) {
        // Google path: synchronous generation via submitGeneration
        const result = await submitGeneration({
          accessToken: data.accessToken,
          userId: user.id,
          prompt: variedPrompt,
          modelId: 'fal-ai/nano-banana-2/edit',
          aspectRatio,
          imageBase64: imageBase64?.data,
          metadata: {
            original_prompt: rootPrompt,
            generation_type: 'variation',
            source_image_id: sourceImageId,
            root_image_id: rootImageId,
          },
        })

        results.push({
          recordId: result.recordId,
          request_id: result.request_id,
        })
      } else {
        // FAL path: async queue submission
        const editInput = await buildFalInput({
          modelId: 'fal-ai/nano-banana-2/edit',
          prompt: variedPrompt,
          aspectRatio,
          imageUrls: [falImageUrl ?? ''],
          safetyLevel: 'permissive',
        })
        const { request_id } = await (fal.queue.submit as any)(
          'fal-ai/nano-banana-2/edit',
          { input: editInput },
        )

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
              prompt: variedPrompt,
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
          throw new Error(
            `Failed to create image record: ${insertError.message}`,
          )
        }

        results.push({ recordId: record.id, request_id })
      }
    }

    return results
  })
