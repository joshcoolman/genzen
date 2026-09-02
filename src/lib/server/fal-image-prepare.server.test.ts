import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { prepareImageForFal } from './fal-image-prepare.server'

async function png(width: number, height: number, alpha = false) {
  const image = sharp({
    create: {
      width,
      height,
      channels: alpha ? 4 : 3,
      background: alpha
        ? { r: 10, g: 120, b: 200, alpha: 0.5 }
        : { r: 10, g: 120, b: 200 },
    },
  })
  return (await image.png().toBuffer()).buffer as ArrayBuffer
}

/**
 * A real photograph, not synthetic noise.
 *
 * `public/404.png` is an image this app generated: 1024x1024, 1.3MB of lossless
 * PNG. The first version of these fixtures used blurred random noise, which is
 * the one content type JPEG loses to PNG on outright -- so the function
 * correctly handed the original back and the test was measuring the safety net
 * instead of the behaviour. Real photographic content is the whole premise of
 * re-encoding, so the fixture has to have it.
 */
function photo(): Buffer {
  return readFileSync('public/404.png')
}

async function asPng(input: Buffer, width: number): Promise<ArrayBuffer> {
  const out = await sharp(input).resize(width).png().toBuffer()
  return out.buffer.slice(
    out.byteOffset,
    out.byteOffset + out.byteLength,
  ) as ArrayBuffer
}

/**
 * #560. The library keeps its full-resolution file; only the copy FAL sees is
 * smaller. A model downscales a reference before it looks at it, so the pixels
 * past 2048 were never doing anything.
 */
describe('an image is shrunk for the trip to FAL', () => {
  it('resizes past the long edge and re-encodes to JPEG', async () => {
    const input = await asPng(photo(), 2560)
    const result = await prepareImageForFal(input)

    expect(result.original).toBe(false)
    expect(result.mimeType).toBe('image/jpeg')
    expect(result.buffer.byteLength).toBeLessThan(input.byteLength / 2)
    const { width } = await sharp(Buffer.from(result.buffer)).metadata()
    expect(width).toBe(2048)
  })

  it('re-encodes a heavy PNG that is already small enough to send', async () => {
    // The clause that does the work: the set behind #556 was under the resize
    // threshold and still 20MB on the wire, so a long-edge rule alone would
    // have changed nothing.
    const input = await asPng(photo(), 1600)
    const result = await prepareImageForFal(input)

    expect(result.original).toBe(false)
    expect(result.buffer.byteLength).toBeLessThan(input.byteLength)
    // Not enlarged, and not shrunk either -- it was already small enough.
    const { width } = await sharp(Buffer.from(result.buffer)).metadata()
    expect(width).toBe(1600)
  })

  it('leaves a small image exactly as it came in', async () => {
    const input = await png(64, 64)
    const result = await prepareImageForFal(input)

    expect(result.original).toBe(true)
    expect(result.buffer).toBe(input)
  })

  it('never flattens transparency to make a file smaller', async () => {
    // Alpha onto a colour is a change to the picture, not a compression
    // choice. A big transparent image goes through untouched.
    const input = await png(800, 800, true)
    const result = await prepareImageForFal(input)

    expect(result.original).toBe(true)
  })

  it('keeps PNG when a transparent image is genuinely too big', async () => {
    const result = await prepareImageForFal(await png(3000, 3000, true))

    expect(result.original).toBe(false)
    expect(result.mimeType).toBe('image/png')
    const meta = await sharp(Buffer.from(result.buffer)).metadata()
    expect(meta.width).toBe(2048)
    expect(meta.hasAlpha).toBe(true)
  })

  it('hands back anything it cannot read rather than failing', async () => {
    // The library holds mp4 as well as stills, and a generation must not fail
    // because an optimisation could not run.
    const input = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]).buffer
    const result = await prepareImageForFal(input)

    expect(result.original).toBe(true)
    expect(result.buffer).toBe(input)
  })
})
