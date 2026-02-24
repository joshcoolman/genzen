import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { requireAuth } from '@/lib/server/auth.server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const VARIATION_SYSTEM_PROMPT = `You are a creative director. Your job is to look at a photograph and reimagine the subject in a completely different moment.

STEP 1 — OBSERVE THE IMAGE (do this internally, don't output it):
Study the image carefully. Note the subject's face, hair, build, clothing, accessories, and any distinguishing features. This is your ground truth — not the text prompt.

STEP 2 — WRITE A NEW PROMPT:
Describe the SAME PERSON (using details you observed) in a completely new scenario.

KEEP:
- The subject's appearance as you see it: face, hair, build, clothing, accessories
- Visual style and quality level of the original image

ALWAYS CHANGE:
- POSE and BODY LANGUAGE: completely different physical position — if sitting, have them standing/walking/leaning. Be explicit (e.g., "crouched at the edge of a rooftop" not just "on a rooftop").
- SCENE and LOCATION: entirely new place, time of day, weather, social context
- ACTION and STORY: what just happened? What are they doing? Who else is present?
- COMPOSITION: different framing and camera angle

AVOID THESE ALREADY-USED SCENARIOS (if listed below):
The user may provide a list of prompts that have already been generated. You MUST avoid producing anything similar to those. Choose a genuinely different setting, action, and mood.

Return ONLY the new prompt as plain text. No explanations, no preamble.`

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
      .select('created_at, storage_path, generation_metadata')
      .eq('id', sourceImageId)
      .single()

    // If the source is itself a variation, use the root original prompt instead of the
    // variation's prompt. This prevents the "creative tension" from collapsing when Claude
    // sees an image that perfectly matches the prompt it's given.
    const sourceMetadata = sourceImage?.generation_metadata as Record<string, unknown> | null
    const rootPrompt =
      sourceMetadata?.generation_type === 'variation' && typeof sourceMetadata?.original_prompt === 'string'
        ? sourceMetadata.original_prompt
        : prompt

    const signedUrl = sourceImage?.storage_path
      ? (await supabase.storage.from('user-images').createSignedUrl(sourceImage.storage_path, 3600))
          .data?.signedUrl
      : undefined

    // Fetch image bytes — needed for both Claude (base64) and FAL (upload to get HTTPS URL)
    let imageBase64: { data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' } | undefined
    let falImageUrl: string | undefined
    if (signedUrl) {
      try {
        const imageRes = await fetch(signedUrl)
        const buffer = await imageRes.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        // Detect actual format from magic bytes — don't trust Content-Type header
        let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg'
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

    // Fetch all existing variation prompts in this family so Claude can avoid repeats.
    // Find variations that share the same root source image (or are the source itself).
    const rootSourceId =
      sourceMetadata?.generation_type === 'variation' && typeof sourceMetadata?.source_image_id === 'string'
        ? sourceMetadata.source_image_id
        : sourceImageId
    const { data: existingVariations } = await supabase
      .from('user_images')
      .select('generation_metadata')
      .eq('user_id', user.id)
      .filter('generation_metadata->>generation_type', 'eq', 'variation')
      .or(`generation_metadata->>source_image_id.eq.${rootSourceId},generation_metadata->>source_image_id.eq.${sourceImageId}`)
      .limit(20)
    const usedPrompts = (existingVariations ?? [])
      .map((v) => (v.generation_metadata as Record<string, unknown>)?.prompt)
      .filter((p): p is string => typeof p === 'string')
    // Always include the source image's own prompt — this is the scene Claude is looking at,
    // so it must be explicitly told NOT to reproduce it
    const sourcePrompt =
      typeof sourceMetadata?.prompt === 'string' ? sourceMetadata.prompt : prompt
    if (!usedPrompts.includes(sourcePrompt)) {
      usedPrompts.unshift(sourcePrompt)
    }

    const results: { recordId: string; request_id: string }[] = []
    // Collect prompts generated in this batch so variation 2 avoids repeating variation 1
    const batchPrompts: string[] = []

    for (let i = 0; i < 2; i++) {
      const allUsedPrompts = [...usedPrompts, ...batchPrompts]
      const avoidSection =
        allUsedPrompts.length > 0
          ? `\n\nALREADY GENERATED (avoid similar scenarios):\n${allUsedPrompts.map((p, idx) => `${idx + 1}. ${p}`).join('\n')}`
          : ''

      // Use Claude to reimagine based on what it SEES in the image, not just the text prompt
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
                  { type: 'text', text: `Look at this image. Describe the subject to yourself, then reimagine them in a completely different scene.${avoidSection}` },
                ]
              : `Create a variation of this prompt — put the subject in a completely new scenario:\n\n${rootPrompt}${avoidSection}`,
          },
        ],
      })

      const textContent = response.content.find((c) => c.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in Claude response')
      }

      const variedPrompt = textContent.text.trim()
      batchPrompts.push(variedPrompt)

      // Submit via Kontext for subject-consistent generation, anchored to source image
      const kontextInput: Record<string, unknown> = {
        prompt: variedPrompt,
        guidance_scale: 5.0,
        safety_tolerance: 6,
      }
      if (falImageUrl) {
        kontextInput.image_url = falImageUrl
      }
      const { request_id } = await fal.queue.submit('fal-ai/flux-pro/kontext', {
        input: kontextInput,
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
            original_prompt: rootPrompt,
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
