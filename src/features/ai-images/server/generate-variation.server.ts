import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { generateText } from 'ai'
import { requireAuth } from '@/lib/server/auth.server'
import { ai } from '@/lib/server/ai.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

const VARIATION_SYSTEM_PROMPT = `You are a photographer directing a photoshoot. You are looking at a shot that was just taken and directing the next shot in the SAME session.

STEP 1 — OBSERVE THE IMAGE (do this internally, don't output it):
Study everything: the subject's face, hair, build, clothing, accessories, the location, lighting, time of day, weather, and visual style. This is your ground truth.

STEP 2 — WRITE THE NEXT SHOT:
Describe the SAME PERSON in the SAME LOCATION wearing the SAME CLOTHES — but a different moment in the shoot.

KEEP EXACTLY THE SAME:
- The subject's appearance: face, hair, build, clothing, accessories
- The location, environment, and setting
- Lighting conditions and time of day
- Visual style, color grade, and quality level

CHANGE (pick 1-2 per variation):
- POSE: completely different body position — if standing straight, try crouching/leaning/sitting/walking. Be specific (e.g., "looking over their shoulder" not just "different pose")
- CAMERA ANGLE: shoot from above, below, behind, tight close-up, wide establishing shot, profile view, three-quarter angle
- EXPRESSION and MOOD: laughing, contemplative, intense eye contact, looking away, mid-conversation, candid moment
- FRAMING: full body vs waist-up vs headshot, centered vs rule-of-thirds, foreground elements

DO NOT CHANGE the environment, background, wardrobe, or setting. This is the same photoshoot, same location, same session.

AVOID THESE ALREADY-USED SHOTS (if listed below):
The user may provide previous shots from this session. Choose a distinctly different pose, angle, or expression from what's already been captured.

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

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    // Fetch the source image's sort_order and storage_path for vision grounding
    const { data: sourceImage } = await supabase
      .from('user_images')
      .select('sort_order, storage_path, generation_metadata')
      .eq('id', sourceImageId)
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

    const signedUrl = sourceImage?.storage_path
      ? (
          await supabase.storage
            .from('user-images')
            .createSignedUrl(sourceImage.storage_path, 3600)
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
        // Upload to FAL storage to get a public HTTPS URL usable by Kontext (works in dev + prod)
        falImageUrl = await fal.storage.upload(
          new Blob([buffer], { type: mediaType }),
        )
      } catch {
        // proceed without vision grounding if fetch or upload fails
      }
    }

    // Fetch all existing variation prompts in this family so Claude can avoid repeats.
    // Find variations that share the same root source image (or are the source itself).
    const rootSourceId =
      sourceMetadata?.generation_type === 'variation' &&
      typeof sourceMetadata.source_image_id === 'string'
        ? sourceMetadata.source_image_id
        : sourceImageId
    const { data: existingVariations } = await supabase
      .from('user_images')
      .select('generation_metadata')
      .eq('user_id', user.id)
      .filter('generation_metadata->>generation_type', 'eq', 'variation')
      .or(
        `generation_metadata->>source_image_id.eq.${rootSourceId},generation_metadata->>source_image_id.eq.${sourceImageId}`,
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

    const avoidSection =
      usedPrompts.length > 0
        ? `\n\nALREADY GENERATED (avoid similar shots):\n${usedPrompts.map((p, idx) => `${idx + 1}. ${p}`).join('\n')}`
        : ''

    // Use Claude to reimagine based on what it SEES in the image, not just the text prompt
    const userContent = imageBase64
      ? [
          {
            type: 'image' as const,
            image: `data:${imageBase64.mediaType};base64,${imageBase64.data}`,
          },
          {
            type: 'text' as const,
            text: `Look at this shot from the photoshoot. Direct the next shot — same person, same location, same clothes, but a different pose, angle, or expression.${avoidSection}`,
          },
        ]
      : `Create another shot from the same photoshoot — same person, same location, same clothes, different pose/angle/expression:\n\n${rootPrompt}${avoidSection}`

    const response = await generateText({
      model: ai.sonnet,
      maxOutputTokens: 300,
      system: VARIATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    })

    const variedPrompt = response.text.trim()

    // Submit via Kontext for subject-consistent generation, anchored to source image
    const kontextInput = {
      prompt: variedPrompt,
      image_url: falImageUrl ?? '',
      guidance_scale: 7.0,
      safety_tolerance: '6' as const,
    }
    const { request_id } = await fal.queue.submit('fal-ai/flux-pro/kontext', {
      input: kontextInput,
    })

    // Slot variation just below source via fractional sort_order
    const variationSortOrder =
      (sourceImage?.sort_order ?? Date.now() / 1000) - 0.001

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

    return [{ recordId: record.id, request_id }]
  })
