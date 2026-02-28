import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { generateText } from 'ai'
import { requireAuth } from '@/lib/server/auth.server'
import { checkAndDeductCredits } from '@/features/credits/server/check-credits.server'
import { ai } from '@/lib/server/ai.server'
import {
  IMAGE_VARIATION_SYSTEM,
  variationUserContent,
} from '@/lib/prompts/image-variation'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface GenerateVariationInput {
  accessToken: string
  prompt: string
  model: string
  sourceImageId: string
  count?: number
}

export const generateVariation = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateVariationInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    const { prompt, model, sourceImageId } = data
    const variationCount = Math.min(data.count ?? 1, 4)

    if (!prompt.trim()) {
      throw new Error('Prompt is required')
    }

    if (!process.env.FAL_KEY) {
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

    const count = Math.min(data.count ?? 1, 4)
    const baseSortOrder = sourceImage?.sort_order ?? Date.now() / 1000
    const results: Array<{ recordId: string; request_id: string }> = []

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
        model: ai.sonnet,
        maxOutputTokens: 300,
        system: IMAGE_VARIATION_SYSTEM,
        messages: [{ role: 'user', content: userContent }],
      })

      const variedPrompt = response.text.trim()
      usedPrompts.push(variedPrompt)

      const editInput = {
        prompt: variedPrompt,
        image_urls: [falImageUrl ?? ''],
        safety_tolerance: '5' as const,
      }
      const { request_id } = await fal.queue.submit(
        'fal-ai/nano-banana-pro/edit',
        { input: editInput },
      )

      const variationSortOrder = baseSortOrder - 0.001 * (i + 1)

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

      results.push({ recordId: record.id, request_id })
    }

    return results
  })
