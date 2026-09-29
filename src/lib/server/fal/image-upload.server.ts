import { fal } from './client.server'
import { prepareImageForFal } from './image-prepare.server'
import { withNetworkRetry } from './retry.server'

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
