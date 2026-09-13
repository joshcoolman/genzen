'use server'

import { generateObject } from 'ai'
import { z } from 'zod'
import type { VisionImage } from '#/lib/server/vision-image.server'
import metaPromptSystem from '#/lib/prompts/meta-prompt.md'
import { ai, requireAiRole } from '#/lib/server/ai.server'
import { resolveAuth } from '#/lib/server/auth.server'
import { sql } from '#/lib/server/db.server'
import { loadVisionImage } from '#/lib/server/vision-image.server'

/** Enough for a strip you would actually stage. Past this the pictures crowd
 *  the instruction and the prompts stop referring to any of them in particular
 *  -- and every image is bytes in one request (#436). */
const MAX_IMAGES = 8

/** A set written in one completion, not a batch job. Past this the model is
 *  filling a quota rather than answering the request. */
const MAX_PROMPTS = 12

const schema = z.object({
  prompts: z
    .array(
      z
        .string()
        .describe(
          'One complete image prompt, standing on its own with no reference to the other prompts or to the pictures.',
        ),
    )
    .describe('The prompts, in the order the request asked for them'),
})

/**
 * The staged references plus a rough request, in; one or several finished
 * prompts, out (#645).
 *
 * **One call for the whole set, which is the entire mechanism.** Three
 * character sheets written by three separate calls drift -- different layouts,
 * different levels of detail -- because nothing ties them together. Written by
 * one completion that can see the request names three siblings, they agree.
 * That needs no roles, no schema per prompt and no shared-continuity field;
 * it needs the model to see the whole ask at once.
 *
 * The contract is an ordered array of prompts and nothing else. Nothing here
 * is labelled, roled or tied back to a particular reference: what comes back
 * lands in the prompt list as rows, editable like any other.
 */
export async function writeMetaPrompts(data: {
  /** The staged strip, in panel order. That order is what "image 2" means to
   *  the model, so it is preserved through the lookup. */
  imageIds: Array<string>
  /** What the user typed. Roughly what they want; not a specification. */
  request: string
}): Promise<{ prompts: Array<string> }> {
  const { userId } = await resolveAuth()
  requireAiRole('reasoning')

  const request = data.request.trim()
  if (!request) throw new Error('Say roughly what you want.')

  const imageIds = data.imageIds.slice(0, MAX_IMAGES)
  if (imageIds.length === 0) throw new Error('Stage a reference image first.')
  for (const id of imageIds) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid image id')
  }

  const rows = await sql<Array<{ id: string; storage_path: string | null }>>`
    select id, storage_path
    from user_images
    where id = any(${imageIds}) and user_id = ${userId}
  `
  const byId = new Map(rows.map((r) => [r.id, r.storage_path]))

  const images: Array<VisionImage> = []
  for (const id of imageIds) {
    const path = byId.get(id)
    const bytes = path ? await loadVisionImage(path) : null
    // A missing picture throws rather than renumbering the rest: the request
    // refers to what is on screen, and prompts written against a set with a
    // hole in it are wrong in a way nobody can see.
    if (!bytes) throw new Error('Could not read one of the reference images.')
    images.push(bytes)
  }

  const { object } = await generateObject({
    model: ai.reasoning,
    // Room for a dozen prompts at full length. The per-prompt ceiling is the
    // instruction's job, not the budget's.
    maxOutputTokens: 4000,
    temperature: 1,
    system: metaPromptSystem,
    schema,
    messages: [{ role: 'user', content: metaPromptContent(images, request) }],
  })

  const prompts = object.prompts.map((p) => p.trim()).filter(Boolean)
  if (prompts.length === 0) throw new Error('Nothing came back.')
  return { prompts: prompts.slice(0, MAX_PROMPTS) }
}

/**
 * The message turn carrying the pictures and the ask.
 *
 * Assembly, so it lives here rather than in `src/lib/prompts/` (#322): it
 * interleaves base64 images with text. Each picture is announced by number
 * first -- the same binding `generateVariationPrompts` establishes -- so a
 * request that names "the frog" has something to attach to.
 */
function metaPromptContent(images: Array<VisionImage>, request: string) {
  return [
    ...images.flatMap((img, index) => [
      { type: 'text' as const, text: `Image ${index + 1}:` },
      {
        type: 'image' as const,
        image: `data:${img.mediaType};base64,${img.data}`,
      },
    ]),
    {
      type: 'text' as const,
      text: `Look at ${images.length === 1 ? 'this image' : `these ${images.length} images`}. The user asks for:\n\n${request}`,
    },
  ]
}
