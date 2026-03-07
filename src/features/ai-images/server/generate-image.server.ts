import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { buildFalInput } from './fal-params.server'
import { requireAuth } from '@/lib/server/auth.server'
import { checkAndDeductCredits } from '@/features/credits/server/check-credits.server'
import { describeImage } from '@/lib/server/describe-image.server'
import { ALL_IMAGE_MODELS } from '@/features/ai-images/models'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface GenerateImageInput {
  prompt: string
  model: string
  accessToken: string
  aspectRatio?: string
  sourceImageBase64?: string
  sourceImageUrl?: string
  isRefine?: boolean
}

function buildRefinePrompt(userPrompt: string): string {
  return `Re-imagine this: ${userPrompt}`
}

export const generateImage = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateImageInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    const {
      prompt,
      model,
      aspectRatio,
      sourceImageBase64,
      sourceImageUrl,
      isRefine,
    } = data

    if (!sourceImageBase64 && !sourceImageUrl && !prompt.trim()) {
      throw new Error('Prompt is required')
    }

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    const creditResult = await checkAndDeductCredits(
      data.accessToken,
      'image_gen',
    )
    if (!creditResult.allowed) {
      throw new Error('Insufficient credits')
    }

    const modelDef = ALL_IMAGE_MODELS.find((m) => m.id === model)

    let falModelId = model
    let effectivePrompt = prompt.trim()
    let imageUrl: string | null = null

    if (sourceImageUrl) {
      imageUrl = sourceImageUrl
      falModelId = modelDef?.imageInputModelId ?? model
    } else if (sourceImageBase64) {
      // Strip data URL prefix and decode to buffer
      const base64Data = sourceImageBase64.replace(
        /^data:image\/\w+;base64,/,
        '',
      )
      const buffer = Buffer.from(base64Data, 'base64')

      // Detect mime type from magic bytes
      let mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' =
        'image/jpeg'
      const bytes = new Uint8Array(buffer.slice(0, 4))
      if (bytes[0] === 0x89 && bytes[1] === 0x50) {
        mimeType = 'image/png'
      } else if (bytes[0] === 0x47 && bytes[1] === 0x49) {
        mimeType = 'image/gif'
      } else if (bytes[0] === 0x52 && bytes[1] === 0x49) {
        mimeType = 'image/webp'
      }

      // If no user prompt, ask Haiku for a plain factual description of the image
      if (!effectivePrompt) {
        try {
          effectivePrompt = await describeImage(base64Data, 'anchor')
        } catch {
          effectivePrompt = 'image'
        }
      }

      // Upload to FAL storage
      imageUrl = await fal.storage.upload(
        new Blob([buffer], { type: mimeType }),
      )

      // Use image-mode endpoint if specified
      falModelId = modelDef?.imageInputModelId ?? model
    }

    // Save the user-facing prompt before any model-specific wrapping
    const metadataPrompt = effectivePrompt

    // Apply refine wrapping for FAL only
    if (sourceImageUrl && isRefine) {
      effectivePrompt = buildRefinePrompt(effectivePrompt)
    }

    // Build FAL input using schema-driven param resolution
    const falInput = await buildFalInput({
      modelId: falModelId,
      prompt: effectivePrompt,
      aspectRatio,
      imageUrl: imageUrl ?? undefined,
      safetyLevel: 'permissive',
    })

    // Submit to FAL async queue (returns immediately)
    const { request_id } = await (fal.queue.submit as any)(falModelId, {
      input: falInput,
    })

    // Create Supabase client authenticated as the user
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    // Create database record with pending status
    const { data: record, error: insertError } = await supabase
      .from('user_images')
      .insert({
        user_id: user.id,
        request_id: request_id,
        status: 'pending',
        source: 'ai_generated',
        title: 'Generating...',
        sort_order: Date.now() / 1000,
        generation_metadata: {
          prompt: metadataPrompt,
          model,
          fal_model_id: falModelId,
          submitted_at: new Date().toISOString(),
          ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
          ...(sourceImageBase64 ? { has_source_image: true } : {}),
          ...(sourceImageUrl ? { source_image_url: sourceImageUrl } : {}),
        },
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create image record: ${insertError.message}`)
    }

    return {
      recordId: record.id,
      request_id,
      prompt,
      model,
    }
  })
