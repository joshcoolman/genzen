import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { requireAuth } from '@/lib/server/auth.server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const VARIATION_SYSTEM_PROMPT = `You are a creative photography director. Given an image generation prompt, you create a fresh variation that feels like a different frame from the same shoot.

KEEP THE SAME:
- The subject (same person/animal/object type, same general description)
- The setting/environment
- Camera specs (lens, film stock, framing) and aspect ratio
- The overall mood and style

CHANGE CREATIVELY:
- The angle or perspective (low angle, over-the-shoulder, from behind, bird's eye)
- The action or moment (different gesture, interaction, expression)
- The pose or body language
- Small environmental details (different lighting moment, background activity)
- The "decisive moment" - capture a different instant

Think like a photographer doing a real shoot: same subject, same location, but each frame tells a slightly different story.

Return ONLY the new prompt as plain text. No explanations.`

interface GenerateVariationInput {
  accessToken: string
  prompt: string
  model: string
  sourceImageId: string
}

export const generateVariation = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateVariationInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    const { prompt, model, sourceImageId } = data

    if (!prompt.trim()) {
      throw new Error('Prompt is required')
    }

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set')
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

    // Fetch the source image's created_at so variations sort next to it
    const { data: sourceImage } = await supabase
      .from('user_images')
      .select('created_at')
      .eq('id', sourceImageId)
      .single()

    const results: { recordId: string; request_id: string }[] = []

    for (let i = 0; i < 2; i++) {
      // Use Claude to reimagine the prompt for each variation
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: [
          {
            type: 'text',
            text: VARIATION_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: `Create variation ${i + 1} of this prompt:\n\n${prompt}`,
          },
        ],
      })

      const textContent = response.content.find((c) => c.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in Claude response')
      }

      const variedPrompt = textContent.text.trim()

      // Submit as fresh text-to-image generation
      const { request_id } = await fal.queue.submit(model, {
        input: { prompt: variedPrompt },
      })

      // Offset created_at by 1-2 seconds after source so variations sort right next to it
      const variationTimestamp = sourceImage?.created_at
        ? new Date(new Date(sourceImage.created_at).getTime() + (i + 1) * 1000).toISOString()
        : undefined

      const { data: record, error: insertError } = await supabase
        .from('user_images')
        .insert({
          user_id: user.id,
          request_id,
          status: 'pending',
          source: 'ai_generated',
          title: 'Generating variation...',
          ...(variationTimestamp && { created_at: variationTimestamp }),
          generation_metadata: {
            prompt: variedPrompt,
            original_prompt: prompt,
            model,
            generation_type: 'variation',
            source_image_id: sourceImageId,
            submitted_at: new Date().toISOString(),
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
