'use server'

import { modelTitleFor } from '#/features/ai-images/models'
import { resolveAuth } from '#/lib/server/auth.server'
import { jsonb, sql } from '#/lib/server/db.server'
import { downloadAndStoreImage } from '#/lib/server/image-storage.server'
import { generateThumbnailInBackground } from '#/lib/server/generate-thumbnail.server'
import { createImageStorage } from '#/lib/image-storage'

/**
 * Keep: the only thing on this page that writes anything (#578).
 *
 * **The bytes are fetched here rather than a url being handed to a row.** What
 * the board holds is a FAL url, and those expire -- a row pointing at one would
 * be a library entry that works until it does not. The download is also why
 * Keep can fail on a stale tile while the rest of the board still looks fine,
 * which is the honest outcome: the picture is genuinely gone.
 *
 * **The row is written completed rather than reserved and polled.** Everything
 * else in the app reserves first so a generation survives a reload; there is
 * nothing to survive here, because the image already exists and this is an
 * ingest. It lands in the library like any other picture, which is the whole
 * point -- these are first frames for characters developed in Images.
 */
export async function keepPerson(data: {
  /** The FAL url on the tile. */
  url: string
  /** The paragraph that made it, kept as the row's description. */
  spec: string
  /** The picker id it was rendered on, for the title and metadata. */
  modelId: string
}): Promise<{ imageId: string }> {
  const { userId } = await resolveAuth()

  if (!/^https?:\/\//i.test(data.url)) throw new Error('Not an image url')

  const { storagePath, fileName, fileHash, fileSize } =
    await downloadAndStoreImage(userId, data.url)

  const description = data.spec.trim().slice(0, 997)

  try {
    const [row] = await sql<Array<{ id: string }>>`
      insert into user_images (
        user_id, title, description, source, origin, status,
        storage_path, file_name, file_size, file_hash, mime_type,
        generation_metadata
      ) values (
        ${userId},
        ${modelTitleFor(data.modelId)},
        ${description},
        'ai_generated',
        'images',
        'completed',
        ${storagePath},
        ${fileName},
        ${fileSize},
        ${fileHash},
        'image/png',
        ${jsonb({
          prompt: description,
          model: data.modelId,
          fal_model_id: data.modelId,
          // Named so a row kept here is recognisable later: these did not go
          // through the queue, so they carry no request id and never appeared
          // in Activity.
          kept_from: 'lab/people',
          completed_at: new Date().toISOString(),
        })}
      )
      returning id
    `
    generateThumbnailInBackground(userId, storagePath, row.id)
    return { imageId: row.id }
  } catch (err) {
    // The object landed before the row could point at it. Without this it is
    // orphaned -- nothing references it and nothing will clean it up.
    await createImageStorage().remove([storagePath])
    throw new Error(
      `Keep failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}
