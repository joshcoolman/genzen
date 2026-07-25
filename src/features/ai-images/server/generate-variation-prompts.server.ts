import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { generateText } from 'ai'
import { requireAuth } from '@/lib/server/auth.server'
import { ai } from '@/lib/server/ai.server'
import {
  IMAGE_VARIATION_SYSTEM,
  variationUserContent,
} from '@/lib/prompts/image-variation'
import { createImageStorage } from '@/lib/image-storage'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface GenerateVariationPromptsInput {
  accessToken: string
  prompt: string
  sourceImageId: string
  count: number
  existingPrompts?: Array<string>
  guidance?: string
}

export const generateVariationPrompts = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateVariationPromptsInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)
    const { prompt, sourceImageId } = data
    const count = Math.min(data.count, 4)

    if (!prompt.trim()) throw new Error('Prompt is required')

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    if (!/^[0-9a-f-]{36}$/i.test(sourceImageId)) {
      throw new Error('Invalid sourceImageId')
    }

    const { data: sourceImage } = await supabase
      .from('user_images')
      .select('sort_order, storage_path, generation_metadata')
      .eq('id', sourceImageId)
      .eq('user_id', user.id)
      .single()

    const sourceMetadata = sourceImage?.generation_metadata as Record<
      string,
      unknown
    > | null
    const rootPrompt =
      sourceMetadata?.generation_type === 'variation' &&
      typeof sourceMetadata.original_prompt === 'string'
        ? sourceMetadata.original_prompt
        : prompt

    const rootImageId =
      typeof sourceMetadata?.root_image_id === 'string'
        ? sourceMetadata.root_image_id
        : sourceMetadata?.generation_type === 'variation' &&
            typeof sourceMetadata.source_image_id === 'string'
          ? sourceMetadata.source_image_id
          : sourceImageId

    // Use root image for vision to prevent quality drift
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
    }

    const signedUrl = imageStoragePath
      ? await createImageStorage().getUrl(imageStoragePath)
      : undefined

    // Fetch image bytes for Claude vision + FAL upload
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
        falImageUrl = await fal.storage.upload(
          new Blob([buffer], { type: mediaType }),
        )
      } catch {
        // proceed without vision grounding
      }
    }

    // Fetch existing variation prompts to avoid repeats
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
    const sourcePrompt =
      typeof sourceMetadata?.prompt === 'string'
        ? sourceMetadata.prompt
        : prompt
    if (!usedPrompts.includes(sourcePrompt)) {
      usedPrompts.unshift(sourcePrompt)
    }
    // Merge in any prompts the caller already has (e.g. from "generate more")
    if (data.existingPrompts) {
      for (const ep of data.existingPrompts) {
        if (!usedPrompts.includes(ep)) {
          usedPrompts.push(ep)
        }
      }
    }

    // Generate N prompts via Claude Sonnet
    const prompts: Array<string> = []
    for (let i = 0; i < count; i++) {
      const avoidSection =
        usedPrompts.length > 0
          ? `\n\nALREADY GENERATED (avoid similar shots):\n${usedPrompts.map((p, idx) => `${idx + 1}. ${p}`).join('\n')}`
          : ''

      const userContent = variationUserContent({
        avoidSection,
        hasImage: !!imageBase64,
        imageBase64,
        rootPrompt,
        guidance: data.guidance,
      })

      const response = await generateText({
        model: ai.reasoning,
        maxOutputTokens: 300,
        system: IMAGE_VARIATION_SYSTEM,
        messages: [{ role: 'user', content: userContent }],
      })

      const variedPrompt = response.text.trim()
      usedPrompts.push(variedPrompt)
      prompts.push(variedPrompt)
    }

    return {
      prompts,
      rootPrompt,
      rootImageId,
      sourceImageId,
      falImageUrl,
    }
  })
