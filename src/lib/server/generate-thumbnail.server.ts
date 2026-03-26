import sharp from 'sharp'
import type { SupabaseClient } from '@supabase/supabase-js'

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
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('user-images')
      .download(storagePath)

    if (downloadError) return null

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

    const { error: uploadError } = await supabase.storage
      .from('user-images')
      .upload(thumbnailPath, thumbBuffer, {
        contentType: 'image/webp',
        cacheControl: '31536000',
        upsert: true,
      })

    if (uploadError) return null

    return thumbnailPath
  } catch {
    return null
  }
}
