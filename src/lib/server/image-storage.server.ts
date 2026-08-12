import crypto from 'node:crypto'
import { createImageStorage } from '#/lib/image-storage'

interface StoredAsset {
  storagePath: string
  fileName: string
  fileHash: string
  fileSize: number
}

/**
 * Pull an asset FAL produced into our own bucket.
 *
 * FAL's output URL is public, unauthenticated and not ours to keep alive
 * (#305): its retention is the provider's decision, and generation is
 * non-deterministic, so a URL that 404s cannot be re-created by running the
 * same request again. Every asset therefore lands in the bucket before the row
 * points at anything.
 */
async function downloadAndStore(
  userId: string,
  url: string,
  extension: string,
  contentType: string,
): Promise<StoredAsset> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch asset: ${response.statusText}`)
  }

  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  const fileHash = crypto.createHash('sha256').update(bytes).digest('hex')

  const timestamp = Date.now()
  const uuid = crypto.randomUUID()
  const fileName = `ai_${timestamp}_${uuid}.${extension}`
  const storagePath = `${userId}/${fileName}`

  await createImageStorage().upload(storagePath, bytes, { contentType })

  return { storagePath, fileName, fileHash, fileSize: bytes.length }
}

export async function downloadAndStoreImage(
  userId: string,
  imageUrl: string,
): Promise<StoredAsset> {
  return downloadAndStore(userId, imageUrl, 'png', 'image/png')
}

/**
 * Same path for a generated clip. Separate from the image helper only because
 * the extension and content type are baked in there; `video/mp4` is the one
 * video type `user_images_mime_type_check` allows.
 */
export async function downloadAndStoreVideo(
  userId: string,
  videoUrl: string,
): Promise<StoredAsset> {
  return downloadAndStore(userId, videoUrl, 'mp4', 'video/mp4')
}
