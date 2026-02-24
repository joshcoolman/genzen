import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { requireAuth } from '@/lib/server/auth.server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const VARIATION_SYSTEM_PROMPT = `You are a creative director reimagining what a subject could be doing in a completely different moment or place.

KEEP:
- The subject's identity and appearance (Kontext will anchor this visually)
- Camera/lens specs, film stock, visual style
- Image quality descriptors

CHANGE BOLDLY — surprise the viewer:
- Put the subject somewhere entirely different: a new location, time of day, social setting
- Invent a new story beat: what are they doing an hour later? Who are they with? What just happened?
- Shift the emotional register: intimate vs. epic, quiet vs. chaotic, solitary vs. crowded
- New action, interaction, or environmental drama
- The goal is to feel like a different chapter of the same story, not a different angle of the same scene

Examples of the spirit:
- Street scene → same person now in a dimly lit jazz bar, leaning into conversation
- Portrait → same subject caught mid-laugh at an outdoor market, motion blur of crowds behind them
- Landscape with figure → same figure now silhouetted against a storm rolling in from the ocean

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

    // Fetch the source image's created_at so variations sort next to it, and storage_path for vision grounding
    const { data: sourceImage } = await supabase
      .from('user_images')
      .select('created_at, storage_path')
      .eq('id', sourceImageId)
      .single()

    const signedUrl = sourceImage?.storage_path
      ? (await supabase.storage.from('user-images').createSignedUrl(sourceImage.storage_path, 3600))
          .data?.signedUrl
      : undefined

    // Fetch image bytes — needed for both Claude (base64) and FAL (upload to get HTTPS URL)
    let imageBase64: { data: string; mediaType: string } | undefined
    let falImageUrl: string | undefined
    if (signedUrl) {
      try {
        const imageRes = await fetch(signedUrl)
        const buffer = await imageRes.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        // Detect actual format from magic bytes — don't trust Content-Type header
        let mediaType = 'image/jpeg'
        if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
          mediaType = 'image/png'
        } else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
          mediaType = 'image/webp'
        }
        imageBase64 = {
          data: Buffer.from(buffer).toString('base64'),
          mediaType,
        }
        // Upload to FAL storage to get a public HTTPS URL usable by Kontext (works in dev + prod)
        falImageUrl = await fal.storage.upload(new Blob([buffer], { type: mediaType }))
      } catch {
        // proceed without vision grounding if fetch or upload fails
      }
    }

    const results: { recordId: string; request_id: string }[] = []

    for (let i = 0; i < 2; i++) {
      // Use Claude to reimagine the prompt for each variation
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
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
            content: imageBase64
              ? [
                  {
                    type: 'image',
                    source: { type: 'base64', media_type: imageBase64.mediaType, data: imageBase64.data },
                  },
                  { type: 'text', text: `Create variation ${i + 1} of this image using this prompt as the base:\n\n${prompt}` },
                ]
              : `Create variation ${i + 1} of this prompt:\n\n${prompt}`,
          },
        ],
      })

      const textContent = response.content.find((c) => c.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in Claude response')
      }

      const variedPrompt = textContent.text.trim()

      // Submit via Kontext for subject-consistent generation, anchored to source image
      const { request_id } = await fal.queue.submit('fal-ai/flux-pro/kontext', {
        input: {
          prompt: variedPrompt,
          ...(falImageUrl && { image_url: falImageUrl }),
        },
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
