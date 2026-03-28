import sharp from 'sharp'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createImageStorage } from '@/lib/image-storage'

const THUMBNAIL_WIDTH = 400
const THUMBNAIL_QUALITY = 80

/**
 * Downloads an image from Supabase storage, resizes it to a 400px-wide WebP
 * thumbnail, and uploads it to `{userId}/thumbs/{filename}.webp`.
 *
 * Returns the thumbnail storage path on success, or null on any failure.
 * Failures are silent — callers should fall back to the original image.
 */
export async function generateAndStoreThumbnail(
  supabase: SupabaseClient,
  userId: string,
  storagePath: string,
): Promise<string | null> {
  try {
    const storage = createImageStorage(supabase)

    const fileData = await storage.download(storagePath)
    const buffer = Buffer.from(await fileData.arrayBuffer())

    const thumbBuffer = await sharp(buffer)
      .resize(THUMBNAIL_WIDTH, null, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toBuffer()

    const filename = storagePath.split('/').pop() ?? storagePath
    const thumbFilename = filename.replace(/\.[^.]+$/, '.webp')
    const thumbnailPath = `${userId}/thumbs/${thumbFilename}`

    await storage.upload(thumbnailPath, thumbBuffer, {
      contentType: 'image/webp',
      upsert: true,
    })

    return thumbnailPath
  } catch {
    return null
  }
}

/**
 * Fire-and-forget: generates a thumbnail and updates the DB record's
 * thumbnail_path. Errors are silently swallowed.
 */
export function generateThumbnailInBackground(
  supabase: SupabaseClient,
  userId: string,
  storagePath: string,
  recordId: string,
): void {
  generateAndStoreThumbnail(supabase, userId, storagePath)
    .then(async (thumbnailPath) => {
      if (thumbnailPath) {
        await supabase
          .from('user_images')
          .update({ thumbnail_path: thumbnailPath })
          .eq('id', recordId)
      }
    })
    .catch(() => {})
}
