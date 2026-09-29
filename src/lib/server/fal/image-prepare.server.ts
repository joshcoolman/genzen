import 'server-only'
import sharp from 'sharp'

/**
 * What an image is shrunk to before it is sent to FAL (#560).
 *
 * The number is the reference sheet's, and so is the evidence behind it
 * (`reference-sheet.server.ts`): **a model downscales a reference before it
 * looks at anything, somewhere around a 1024-1536 long edge**, so pixels past
 * this are the same detail squeezed harder rather than more of it. 2048 keeps
 * headroom over that estimate for the case where it is wrong.
 */
export type ImageMediaType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif'

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

const LONG_EDGE = 2048

/**
 * Above this, a picture with no transparency is re-encoded even when it is
 * already small enough to send.
 *
 * This is the clause that does the work, and a long-edge rule alone would have
 * done nothing: the set that provoked #556 was eight 1920px PNG keyframes at
 * 0.9-2.3MB each -- under the resize threshold, and still 20MB on the wire.
 * PNG is lossless and photographic frames are the worst case for it. #482
 * measured the same trade on the reference sheet: ~9MB PNG against ~1.1MB JPEG
 * for the same twelve cells.
 */
const REENCODE_OVER_BYTES = 400 * 1024

/** JPEG quality. The reference sheet's number, for the same reason: the thing
 *  being encoded is what the generation is *about*, so this is the wrong place
 *  to be thrifty. The saving comes from not sending lossless PNG at all. */
const JPEG_QUALITY = 95

export interface PreparedImage {
  buffer: ArrayBuffer
  mimeType: string
  /** True when the bytes are the originals, untouched. */
  original: boolean
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer
}

/**
 * Shrink an image for the trip to FAL, or hand back exactly what came in.
 *
 * **The stored file is never touched.** This is a transport concern: the
 * library row keeps its full-resolution original, and only the copy FAL sees is
 * smaller.
 *
 * **Never fatal.** Anything sharp cannot read -- a clip's mp4, a format it does
 * not know, a truncated file -- goes through as-is. A generation must not fail
 * because an optimisation could not run; the worst case is the behaviour that
 * existed before this.
 *
 * **Transparency keeps its format.** Flattening alpha onto a colour is a change
 * to the picture, not a compression choice, so an image with an alpha channel
 * is resized as a PNG and never re-encoded merely for being large.
 */
export async function prepareImageForFal(
  input: ArrayBuffer,
): Promise<PreparedImage> {
  const bytes = Buffer.from(input)
  const passthrough: PreparedImage = {
    buffer: input,
    mimeType: detectImageMimeType(new Uint8Array(input)),
    original: true,
  }

  try {
    const image = sharp(bytes, { failOn: 'none' })
    const { width, height, hasAlpha } = await image.metadata()
    if (!width || !height) return passthrough

    const longEdge = Math.max(width, height)
    const oversized = longEdge > LONG_EDGE
    const heavy = bytes.byteLength > REENCODE_OVER_BYTES

    // Nothing to gain: small enough to send, and small enough on disk.
    if (!oversized && !heavy) return passthrough
    // Large, but re-encoding it would mean deciding what its transparency
    // should become.
    if (hasAlpha && !oversized) return passthrough

    // `withoutEnlargement` rather than a branch: an image under the threshold
    // that is only being re-encoded must come out the size it went in.
    const resized = image.resize({
      width: LONG_EDGE,
      height: LONG_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })

    const out = hasAlpha
      ? await resized.png().toBuffer()
      : await resized.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer()

    // A re-encode that made it bigger is a re-encode not worth having --
    // possible for flat graphics, where PNG beats JPEG outright.
    if (out.byteLength >= bytes.byteLength) return passthrough

    return {
      buffer: toArrayBuffer(out),
      mimeType: hasAlpha ? 'image/png' : 'image/jpeg',
      original: false,
    }
  } catch {
    return passthrough
  }
}
