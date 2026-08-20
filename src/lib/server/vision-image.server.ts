import sharp from 'sharp'
import { createImageStorage } from '#/lib/image-storage'

/**
 * The longest edge Claude will actually look at. Anything larger is scaled down
 * before the model sees it, so sending the original buys no detail -- it only
 * buys a bigger request.
 */
const MAX_EDGE = 1568
const QUALITY = 82

export interface VisionImage {
  /** base64, no data-URL prefix. */
  data: string
  mediaType: 'image/jpeg'
}

/**
 * A picture off the bucket, sized for a vision call.
 *
 * **Not an optimisation -- a request that works.** Sending originals held for a
 * single image and then failed outright the first time two went in one message:
 * Node destroyed the HTTP/2 session mid-upload (`ERR_HTTP2_INVALID_SESSION`)
 * and the AI SDK retried its way to `Cannot connect to API`, which names
 * everything except the size of what was sent (#436). Four images would have
 * been four times worse. The ceiling was always there; one image was just under
 * it.
 *
 * Re-encoded to JPEG rather than passed through, so one branch covers every
 * source format and the type is known instead of sniffed from magic bytes.
 * `rotate()` first: EXIF orientation is metadata a re-encode drops, and a
 * portrait photo described as a landscape one is a wrong answer with no visible
 * cause.
 *
 * Null when the object cannot be read or decoded. That is not fatal at the call
 * site -- the model can still work from the scene described in words -- so it is
 * a value, not a throw.
 */
export async function loadVisionImage(
  storagePath: string,
): Promise<VisionImage | null> {
  try {
    // Straight from the bucket -- #226 left no URL for a fetch to use.
    const blob = await createImageStorage().download(storagePath)
    const buffer = Buffer.from(await blob.arrayBuffer())

    const resized = await sharp(buffer)
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: QUALITY })
      .toBuffer()

    return { data: resized.toString('base64'), mediaType: 'image/jpeg' }
  } catch {
    return null
  }
}
