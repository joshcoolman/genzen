import { fal } from './fal-client.server'
import {
  detectImageMimeType,
  prepareImageForFal,
} from './fal-image-prepare.server'
import { withNetworkRetry } from './fal-retry.server'
import type { ImageMediaType } from './fal-image-prepare.server'

/** Upload raw bytes to FAL storage with auto-detected MIME. Returns FAL URL. */
export async function uploadBufferToFal(buffer: ArrayBuffer): Promise<string> {
  // Every image the app sends FAL goes through here, which is why both of these
  // live at this level: the shrink that keeps a set from being 20MB on the wire
  // (#560), and the retry that survives a dead connection (#556).
  const { buffer: bytes, mimeType } = await prepareImageForFal(buffer)
  return withNetworkRetry('storage.upload', () =>
    fal.storage.upload(new Blob([bytes], { type: mimeType })),
  )
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
