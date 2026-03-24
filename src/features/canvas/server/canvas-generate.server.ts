import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { generateText } from 'ai'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'
import { checkAndDeductCredits } from '@/features/credits/server/check-credits.server'
import { describeImage } from '@/lib/server/describe-image.server'
import { buildFalInput } from '@/features/ai-images/server/fal-params.server'
import { ai } from '@/lib/server/ai.server'
import { isGoogleProvider, submitGeneration } from '@/lib/server/media.server'
import {
  IMAGE_VARIATION_SYSTEM,
  variationUserContent,
} from '@/lib/prompts/image-variation'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface CanvasGenerateInput {
  accessToken: string
  imageDataUrl: string
  prompt?: string
  model: string
  aspectRatio?: string
  count: number
}

export const canvasGenerate = createServerFn({ method: 'POST' })
  .inputValidator((data: CanvasGenerateInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)
    const count = Math.min(data.count, 4)

    // Deduct credits
    const creditResult = await checkAndDeductCredits(
      data.accessToken,
      'variation',
      count,
    )
    if (!creditResult.allowed) {
      throw new Error('Insufficient credits')
    }

    // Auto-describe image if no prompt provided
    const rootPrompt =
      data.prompt?.trim() || (await describeImage(data.imageDataUrl, 'anchor'))

    // Resolve the edit model ID for the selected model
    const useGoogle = isGoogleProvider(data.model)

    if (!useGoogle && !process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    // Parse data URL to base64 + mime
    const match = data.imageDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/)
    const mime = match?.[1] ?? 'image/jpeg'
    const base64 =
      match?.[2] ?? data.imageDataUrl.replace(/^data:image\/\w+;base64,/, '')

    const imageBase64 = {
      data: base64,
      mediaType: mime as
        | 'image/jpeg'
        | 'image/png'
        | 'image/webp'
        | 'image/gif',
    }

    // Upload to FAL storage for FAL path
    let falImageUrl: string | undefined
    if (!useGoogle) {
      const buffer = Buffer.from(base64, 'base64')
      falImageUrl = await fal.storage.upload(new Blob([buffer], { type: mime }))
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
    const hasUserPrompt = !!data.prompt?.trim()
    const usedPrompts: Array<string> = [rootPrompt]
    const results: Array<{ recordId: string; request_id?: string }> = []

    for (let i = 0; i < count; i++) {
      let variedPrompt: string

      if (hasUserPrompt) {
        // User provided an explicit prompt — use it directly, no Claude rewrite
        variedPrompt = rootPrompt
      } else {
        // No prompt — auto-generate variation directives via Claude
        const avoidSection =
          usedPrompts.length > 0
            ? `\n\nALREADY GENERATED (avoid similar shots):\n${usedPrompts.map((p, idx) => `${idx + 1}. ${p}`).join('\n')}`
            : ''

        const userContent = variationUserContent({
          avoidSection,
          hasImage: true,
          imageBase64,
          rootPrompt,
        })

        const response = await generateText({
          model: ai.sonnet,
          maxOutputTokens: 300,
          system: IMAGE_VARIATION_SYSTEM,
          messages: [{ role: 'user', content: userContent }],
        })

        variedPrompt = response.text.trim()
      }
      usedPrompts.push(variedPrompt)

      const sortOrder = Date.now() / 1000 - 0.001 * (i + 1)

      if (useGoogle) {
        const result = await submitGeneration({
          accessToken: data.accessToken,
          userId: user.id,
          prompt: variedPrompt,
          modelId: data.model,
          aspectRatio: data.aspectRatio,
          imageBase64: base64,
          metadata: {
            original_prompt: rootPrompt,
            generation_type: 'canvas_variation',
          },
        })
        results.push({
          recordId: result.recordId,
          request_id: result.request_id,
        })
      } else {
        const editInput = await buildFalInput({
          modelId: data.model,
          prompt: variedPrompt,
          aspectRatio: data.aspectRatio,
          imageUrls: [falImageUrl ?? ''],
          safetyLevel: 'permissive',
        })

        const { request_id } = await (fal.queue.submit as any)(data.model, {
          input: editInput,
        })

        const { data: record, error: insertError } = await supabase
          .from('user_images')
          .insert({
            user_id: user.id,
            request_id,
            status: 'pending',
            source: 'ai_generated',
            title: 'Generating variation...',
            sort_order: sortOrder,
            generation_metadata: {
              prompt: variedPrompt,
              original_prompt: rootPrompt,
              model: data.model,
              fal_model_id: data.model,
              generation_type: 'canvas_variation',
              submitted_at: new Date().toISOString(),
              ...(data.aspectRatio ? { aspect_ratio: data.aspectRatio } : {}),
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
