import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { generateText } from 'ai'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'
import { ai } from '@/lib/server/ai.server'
import { ALL_IMAGE_MODELS } from '@/features/ai-images/models'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface GenerateImageInput {
  prompt: string
  model: string
  accessToken: string
  aspectRatio?: string
  sourceImageBase64?: string
}

export const generateImage = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateImageInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    const { prompt, model, aspectRatio, sourceImageBase64 } = data

    if (!sourceImageBase64 && !prompt.trim()) {
      throw new Error('Prompt is required')
    }

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    const modelDef = ALL_IMAGE_MODELS.find((m) => m.id === model)

    let falModelId = model
    let effectivePrompt = prompt.trim()
    let imageUrl: string | null = null
    let imageParam: 'image_url' | 'image_urls' = 'image_url'

    if (sourceImageBase64) {
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
          const { text } = await generateText({
            model: ai.haiku,
            system:
              'You are an image description engine for an image-to-image generation pipeline. The generative model will receive both your description and the source image. Your job is to anchor the generation, not reconstruct the image from text.\n\nDescribe the image the way a human would at a glance — the essentials only.\n\nInclude:\n- Shot type and framing\n- Subject basics (age range, gender, hair, clothing in broad strokes)\n- Background in 2-3 words\n- Lighting quality\n- Any single standout visual detail\n\nRules:\n- Keep it under 40 words\n- No interpretation, no emotion, no narrative\n- No specific facial expressions\n- Broad strokes, not forensic detail\n- Comma-separated phrases or one short sentence',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'image', image: base64Data, mimeType },
                  { type: 'text', text: 'Describe this image.' },
                ],
              },
            ],
          })
          effectivePrompt = text.trim()
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
      imageParam = modelDef?.imageInputParam ?? 'image_url'
    }

    // Build FAL input (effectivePrompt and imageUrl are finalized above)
    const falInput: Record<string, unknown> = {
      prompt: effectivePrompt,
      safety_tolerance: 6,
      ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
      ...(imageUrl
        ? imageParam === 'image_urls'
          ? { image_urls: [imageUrl] }
          : { image_url: imageUrl }
        : {}),
    }

    // Submit to FAL async queue (returns immediately)
    const { request_id } = await fal.queue.submit(falModelId, {
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
          prompt: effectivePrompt,
          model,
          fal_model_id: falModelId,
          submitted_at: new Date().toISOString(),
          ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
          ...(sourceImageBase64 ? { has_source_image: true } : {}),
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
