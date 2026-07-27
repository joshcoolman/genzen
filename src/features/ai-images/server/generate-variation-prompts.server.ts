'use server'

import { fal } from '@fal-ai/client'
import { generateText } from 'ai'
import { resolveAuth } from '@/lib/server/auth.server'
import { first, sql } from '@/lib/server/db.server'
import { ai, requireAiRole } from '@/lib/server/ai.server'
import {
  IMAGE_VARIATION_SYSTEM,
  variationUserContent,
} from '@/lib/prompts/image-variation'
import { createImageStorage } from '@/lib/image-storage'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface GenerateVariationPromptsInput {
  prompt: string
  sourceImageId: string
  count: number
  existingPrompts?: Array<string>
  guidance?: string
}

export async function generateVariationPrompts(
  data: GenerateVariationPromptsInput,
) {
  requireAiRole('reasoning')
  const { userId } = await resolveAuth()
  const { prompt, sourceImageId } = data
  const count = Math.min(data.count, 4)

  if (!prompt.trim()) throw new Error('Prompt is required')

  if (!/^[0-9a-f-]{36}$/i.test(sourceImageId)) {
    throw new Error('Invalid sourceImageId')
  }

  const sourceImage = first(
    await sql<
      Array<{
        sort_order: number | null
        storage_path: string | null
        generation_metadata: Record<string, unknown> | null
      }>
    >`
    select sort_order, storage_path, generation_metadata
    from user_images
    where id = ${sourceImageId} and user_id = ${userId}
  `,
  )

  const sourceMetadata = sourceImage?.generation_metadata ?? null
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
    const rootImage = first(
      await sql<Array<{ storage_path: string | null }>>`
      select storage_path from user_images
      where id = ${rootImageId} and user_id = ${userId}
    `,
    )
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
  const existingVariations = await sql<
    Array<{ generation_metadata: Record<string, unknown> }>
  >`
    select generation_metadata
    from user_images
    where user_id = ${userId}
      and generation_metadata->>'generation_type' = 'variation'
      and (generation_metadata->>'root_image_id' = ${rootImageId}
           or generation_metadata->>'source_image_id' = ${rootImageId}
           or generation_metadata->>'source_image_id' = ${sourceImageId})
    limit 20
  `
  const usedPrompts = existingVariations
    .map((v) => v.generation_metadata.prompt)
    .filter((p): p is string => typeof p === 'string')
  const sourcePrompt =
    typeof sourceMetadata?.prompt === 'string' ? sourceMetadata.prompt : prompt
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
}
