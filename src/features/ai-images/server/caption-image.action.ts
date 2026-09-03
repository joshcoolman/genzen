'use server'

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
   * Write the result to the row's `description` (#586).
   *
   * Off by default: the lab's Describe page is a place to read an answer and
   * try another mode, and storing every look would overwrite a caption the
   * user had written. Only the card menu, which exists to annotate the row,
   * asks for it. Requires `imageId` -- there is no row to write to otherwise.
   */
  persist?: boolean
}

export async function captionImage(data: CaptionImageInput) {
  const { userId } = await resolveAuth()

  let image: string = data.imageBase64 ?? ''

  if (data.imageId) {
    if (!/^[0-9a-f-]{36}$/i.test(data.imageId)) {
      throw new Error('Invalid imageId')
    }
    const row = first(
      await sql<Array<{ storage_path: string | null }>>`
      select storage_path from user_images
      where id = ${data.imageId} and user_id = ${userId}
    `,
    )
    if (!row?.storage_path) throw new Error('Image not found')
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
  if (data.persist) {
    if (!data.imageId) throw new Error('persist requires an imageId')
    await updateImageDescription(data.imageId, result)
  }

  return { caption: result }
}
