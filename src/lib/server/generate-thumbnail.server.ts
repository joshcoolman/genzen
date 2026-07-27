import sharp from 'sharp'
import { sql } from './db.server'
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
  userId: string,
  storagePath: string,
): Promise<string | null> {
  try {
    const storage = createImageStorage()

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
  userId: string,
  storagePath: string,
  recordId: string,
): void {
  generateAndStoreThumbnail(userId, storagePath)
    .then(async (thumbnailPath) => {
      if (thumbnailPath) {
        await sql`
          update user_images
          set thumbnail_path = ${thumbnailPath}
          where id = ${recordId}
        `
      }
    })
    .catch(() => {})
}
