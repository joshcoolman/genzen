'use server'

import { generateText } from 'ai'
import type { VisionImage } from '#/lib/server/vision-image.server'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'
import { ai, requireAiRole } from '#/lib/server/ai.server'
import imageVariationSystem from '#/lib/prompts/image-variation.md'
import imageVariationMultiSystem from '#/lib/prompts/image-variation-multi.md'
import { loadVisionImage } from '#/lib/server/vision-image.server'
import { MAX_VARIATION_IMAGES } from '#/features/ai-images/constants'

interface GenerateVariationPromptsInput {
  prompt: string
  /**
   * Ordered, one to `MAX_VARIATION_IMAGES`. The order is the contract: it is
   * what "image 2" means to the model writing the prompts, and it has to be
   * the order the panel then submits in.
   */
  sourceImageIds: Array<string>
  count: number
  existingPrompts?: Array<string>
  guidance?: string
}

export async function generateVariationPrompts(
  data: GenerateVariationPromptsInput,
) {
  requireAiRole('reasoning')
  const { userId } = await resolveAuth()
  const { prompt, sourceImageIds } = data
  const count = Math.min(data.count, 4)

  if (!prompt.trim()) throw new Error('Prompt is required')

  if (sourceImageIds.length === 0) throw new Error('An image is required')
  if (sourceImageIds.length > MAX_VARIATION_IMAGES) {
    throw new Error(`At most ${MAX_VARIATION_IMAGES} images`)
  }
  for (const id of sourceImageIds) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      throw new Error('Invalid sourceImageId')
    }
  }

  /**
   * Two shapes, and only the first has a history to follow.
   *
   * A run about one picture is a variation *of* it: there is a chain behind it,
   * so vision gets the root of that chain and the model is told which shots
   * have already been written. A run about several is a combine — there is no
   * root among four pictures the user chose, and "past variations of this
   * particular set" is not a question the schema can ask. Both mechanisms
   * switch off rather than being generalised (#436).
   */
  const isCombine = sourceImageIds.length > 1
  const sourceImageId = sourceImageIds[0]

  const sourceImage = first(
    await sql<
      Array<{
        storage_path: string | null
        generation_metadata: Record<string, unknown> | null
      }>
    >`
    select storage_path, generation_metadata
    from user_images
    where id = ${sourceImageId} and user_id = ${userId}
  `,
  )

  const sourceMetadata = sourceImage?.generation_metadata ?? null
  const rootPrompt = prompt

  const rootImageId =
    typeof sourceMetadata?.root_image_id === 'string'
      ? sourceMetadata.root_image_id
      : sourceMetadata?.generation_type === 'variation' &&
          typeof sourceMetadata.source_image_id === 'string'
        ? sourceMetadata.source_image_id
        : sourceImageId

  // Storage paths in the caller's order -- models read a list positionally, so
  // a set that arrives shuffled is prompts naming the wrong pictures.
  let storagePaths: Array<string | null>
  if (isCombine) {
    const rows = await sql<Array<{ id: string; storage_path: string | null }>>`
      select id, storage_path
      from user_images
      where id = any(${sourceImageIds}) and user_id = ${userId}
    `
    const byId = new Map(rows.map((r) => [r.id, r.storage_path]))
    storagePaths = sourceImageIds.map((id) => byId.get(id) ?? null)
  } else {
    // Vision sees the root rather than the picture picked, to stop quality
    // drift down a chain of variations.
    let path = sourceImage?.storage_path ?? null
    if (rootImageId !== sourceImageId) {
      const rootImage = first(
        await sql<Array<{ storage_path: string | null }>>`
        select storage_path from user_images
        where id = ${rootImageId} and user_id = ${userId}
      `,
      )
      if (rootImage?.storage_path) path = rootImage.storage_path
    }
    storagePaths = [path]
  }

  const images: Array<VisionImage> = []
  for (const path of storagePaths) {
    const bytes = path ? await loadVisionImage(path) : null
    // One unreadable picture drops the whole set rather than renumbering what
    // is left: a combine whose "image 2" silently became image 3 is worse than
    // one that falls back to describing the scene in words.
    if (!bytes) {
      images.length = 0
      break
    }
    images.push(bytes)
  }

  // Existing shots to avoid, for a single-image run only -- see `isCombine`.
  const usedPrompts: Array<string> = []
  if (!isCombine) {
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
    for (const v of existingVariations) {
      const p = v.generation_metadata.prompt
      if (typeof p === 'string' && !usedPrompts.includes(p)) usedPrompts.push(p)
    }
    const sourcePrompt =
      typeof sourceMetadata?.prompt === 'string'
        ? sourceMetadata.prompt
        : prompt
    if (!usedPrompts.includes(sourcePrompt)) {
      usedPrompts.unshift(sourcePrompt)
    }
  }
  // Merge in any prompts the caller already has (e.g. from "generate more").
  // Unlike the query above this is in hand rather than looked up, so it holds
  // for a combine too -- four directives that repeat each other are the thing
  // being avoided either way.
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
      images,
      rootPrompt,
      guidance: data.guidance,
    })

    const response = await generateText({
      model: ai.reasoning,
      maxOutputTokens: 300,
      // The single-image file opens by telling the model it may describe only
      // what changes, which is the wrong instruction for a combine: naming
      // what each picture contributes is the whole content of that directive.
      system: isCombine ? imageVariationMultiSystem : imageVariationSystem,
      messages: [{ role: 'user', content: userContent }],
    })

    const variedPrompt = response.text.trim()
    usedPrompts.push(variedPrompt)
    prompts.push(variedPrompt)
  }

  return { prompts }
}

/**
 * The message turn that carries the images and the ask.
 *
 * Lives here rather than in `src/lib/prompts/`, which holds prose and nothing
 * else (#322). This is assembly -- it interleaves base64 images with text and
 * branches on how many there are -- so it belongs with the caller. Everything
 * that steers the *output* is in `image-variation.md` and
 * `image-variation-multi.md`.
 *
 * **Each picture is announced by number before it is shown.** That label is the
 * only thing binding "image 2" in the written prompt to a position in the set,
 * and the same binding is re-established for the image model at submit, where
 * `useGenerator` prepends `[Image 1, Image 2, ...]`. Two halves of one contract.
 */
function variationUserContent(opts: {
  avoidSection: string
  images: Array<VisionImage>
  rootPrompt: string
  guidance?: string
}) {
  const guidanceSection = opts.guidance?.trim()
    ? `\n\nUser guidance: ${opts.guidance.trim()}`
    : ''

  if (opts.images.length === 0) {
    return `Write a short variation directive for this scene:\n\n${opts.rootPrompt}${opts.avoidSection}${guidanceSection}`
  }

  const asImage = (img: VisionImage) => ({
    type: 'image' as const,
    image: `data:${img.mediaType};base64,${img.data}`,
  })

  if (opts.images.length === 1) {
    return [
      asImage(opts.images[0]),
      {
        type: 'text' as const,
        text: `Look at this image. Write a short directive for the next shot -- just the change, not the scene.${opts.avoidSection}${guidanceSection}`,
      },
    ]
  }

  return [
    ...opts.images.flatMap((img, index) => [
      { type: 'text' as const, text: `Image ${index + 1}:` },
      asImage(img),
    ]),
    {
      type: 'text' as const,
      text: `Look at these ${opts.images.length} images. Write one directive for a single new picture made from them, naming the images by number where it matters.${opts.avoidSection}${guidanceSection}`,
    },
  ]
}
