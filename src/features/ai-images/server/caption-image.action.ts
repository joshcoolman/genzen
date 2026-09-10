'use server'

import type { SavedAiImage } from '#/features/ai-images/types'
import type { DescribeMode } from '#/lib/prompts/describe'
import { DEFAULT_DESCRIBE_MODE } from '#/lib/prompts/describe'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'
import { describeImage } from '#/lib/server/describe-image.server'
import { createImageStorage } from '#/lib/image-storage'
import { updateImageDescription } from '#/features/user-images/server/images.action'

interface CaptionImageInput {
  imageBase64?: string
  imageId?: string
  mode?: DescribeMode
  /**
   * What the user wants described -- an aspect to concentrate on, something to
   * leave out (#474). Optional: absent is the mode's full output, which is
   * what every caller but the lab's Describe page sends.
   */
  guidance?: string
  /**
   * Save uploads in `description`; generations in metadata's
   * `image_description`, independently of their original prompt.
   *
   * Off by default: the lab's Describe page is a place to read an answer and
   * try another mode, and storing every look would overwrite a caption the
   * user had written. The image details popup asks for persistence. Requires `imageId` -- there is no row to write to otherwise.
   */
  persist?: boolean
}

export async function captionImage(data: CaptionImageInput) {
  const { userId } = await resolveAuth()

  if (data.persist && !data.imageId)
    throw new Error('persist requires an imageId')

  let origin: string | undefined
  let image: string = data.imageBase64 ?? ''

  if (data.imageId) {
    if (!/^[0-9a-f-]{36}$/i.test(data.imageId)) {
      throw new Error('Invalid imageId')
    }
    const row = first(
      await sql<Array<{ storage_path: string | null; origin: string }>>`
      select storage_path, origin from user_images
      where id = ${data.imageId} and user_id = ${userId}
    `,
    )
    if (!row?.storage_path) throw new Error('Image not found')
    origin = row.origin
    // Bytes, not a URL: since #226 the only URL is an authenticated app route,
    // and this call is already server-side with bucket credentials in hand.
    const blob = await createImageStorage().download(row.storage_path)
    image = Buffer.from(await blob.arrayBuffer()).toString('base64')
  }

  const result = await describeImage(
    image,
    data.mode ?? DEFAULT_DESCRIBE_MODE,
    data.guidance,
  )
  let generationMetadata: SavedAiImage['generation_metadata'] = null
  if (data.persist && data.imageId) {
    if (origin === 'upload') {
      await updateImageDescription(data.imageId, result)
    } else {
      // Merge only the new description; never replace the prompt or inputs,
      // including metadata that may have changed while the model was running.
      const updated = first(
        await sql<
          Array<{ generation_metadata: SavedAiImage['generation_metadata'] }>
        >`
          update user_images
          set generation_metadata = jsonb_set(
            coalesce(generation_metadata, '{}'::jsonb),
            '{image_description}', to_jsonb(${result}::text)
          )
          where id = ${data.imageId} and user_id = ${userId}
          returning generation_metadata
        `,
      )
      if (!updated) throw new Error('Image not found')
      generationMetadata = updated.generation_metadata
    }
  }

  return { caption: result, generationMetadata }
}
