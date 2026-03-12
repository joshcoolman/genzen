import { fal } from '@fal-ai/client'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

/** Detect MIME type from magic bytes -- don't trust Content-Type headers. */
export function detectImageMimeType(bytes: Uint8Array): ImageMediaType {
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return 'image/png'
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  )
    return 'image/webp'
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif'
  return 'image/jpeg'
}

/** Upload raw bytes to FAL storage with auto-detected MIME. Returns FAL URL. */
export async function uploadBufferToFal(buffer: ArrayBuffer): Promise<string> {
  const mimeType = detectImageMimeType(new Uint8Array(buffer))
  return fal.storage.upload(new Blob([buffer], { type: mimeType }))
}

/** Fetch image from URL, detect MIME, upload to FAL storage. Returns FAL URL. */
export async function fetchAndUploadToFal(imageUrl: string): Promise<string> {
  const imageRes = await fetch(imageUrl)
  const buffer = await imageRes.arrayBuffer()
  return uploadBufferToFal(buffer)
}

/** Fetch image, return base64 + detected MIME (for LLM vision calls). */
export async function fetchImageAsBase64(imageUrl: string): Promise<{
  data: string
  mediaType: ImageMediaType
  buffer: ArrayBuffer
}> {
  const imageRes = await fetch(imageUrl)
  const buffer = await imageRes.arrayBuffer()
  const mediaType = detectImageMimeType(new Uint8Array(buffer))
  return {
    data: Buffer.from(buffer).toString('base64'),
    mediaType,
    buffer,
  }
}
