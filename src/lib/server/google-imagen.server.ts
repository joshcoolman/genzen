/**
 * Google Imagen via Vertex AI (native generateImages/editImage with aspectRatio).
 * Uses @google/genai SDK in Vertex AI mode with service account auth.
 * Requires GOOGLE_APPLICATION_CREDENTIALS env var pointing to service account JSON key.
 *
 * Multi-image support: when multiple reference images are provided, they're
 * composited into a single image (Vertex AI editImage only accepts one).
 * The prompt is augmented to describe the composite layout.
 */
import sharp from 'sharp'
import { GoogleGenAI, RawReferenceImage } from '@google/genai'

const GOOGLE_PROJECT = 'gen-lang-client-0015600225'
const GOOGLE_LOCATION = 'us-central1'

/** Aspect ratios Imagen supports natively */
const IMAGEN_SUPPORTED_RATIOS = new Set(['1:1', '3:4', '4:3', '9:16', '16:9'])

/** Map app ratios to nearest Imagen-supported ratio */
const RATIO_FALLBACK: Record<string, string> = {
  '3:2': '4:3',
  '2:3': '3:4',
  '5:4': '4:3',
  '4:5': '3:4',
  '21:9': '16:9',
  '2:1': '16:9',
  '1:2': '9:16',
}

function resolveAspectRatio(ratio?: string): string | undefined {
  if (!ratio) return undefined
  if (IMAGEN_SUPPORTED_RATIOS.has(ratio)) return ratio
  return RATIO_FALLBACK[ratio] ?? '1:1'
}

function getClient(): GoogleGenAI {
  const opts: Record<string, unknown> = {
    vertexai: true,
    project: GOOGLE_PROJECT,
    location: GOOGLE_LOCATION,
  }

  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    opts.googleAuthOptions = {
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    }
  }

  return new GoogleGenAI(opts)
}

export interface GoogleGenerateOptions {
  prompt: string
  aspectRatio?: string
}

export interface GoogleEditOptions {
  prompt: string
  imageBase64: string
  additionalImagesBase64?: Array<string>
  aspectRatio?: string
}

export interface GoogleImageResult {
  imageBase64: string
  mimeType: string
}

/**
 * Composite multiple base64 images into a single image.
 * Layout is adaptive: horizontal for landscape/square, vertical for portrait.
 */
async function compositeImages(
  primaryBase64: string,
  additionalBase64: Array<string>,
  aspectRatio?: string,
): Promise<string> {
  const allBuffers = [
    Buffer.from(primaryBase64, 'base64'),
    ...additionalBase64.map((b) => Buffer.from(b, 'base64')),
  ]

  // Determine layout direction from target aspect ratio
  const vertical =
    aspectRatio === '9:16' ||
    aspectRatio === '3:4' ||
    aspectRatio === '4:5' ||
    aspectRatio === '2:3' ||
    aspectRatio === '1:2'

  const metas = await Promise.all(
    allBuffers.map((buf) => sharp(buf).metadata()),
  )

  if (vertical) {
    // Stack vertically: uniform width
    const targetWidth = Math.min(1024, ...metas.map((m) => m.width || 512))
    const resized = await Promise.all(
      allBuffers.map((buf) =>
        sharp(buf).resize({ width: targetWidth }).png().toBuffer(),
      ),
    )
    const resizedMetas = await Promise.all(
      resized.map((buf) => sharp(buf).metadata()),
    )
    const heights = resizedMetas.map((m) => m.height || 512)
    const totalHeight = heights.reduce((a, b) => a + b, 0)

    let top = 0
    const compositeInputs = resized.map((buf, i) => {
      const input = { input: buf, left: 0, top }
      top += heights[i]
      return input
    })

    const result = await sharp({
      create: {
        width: targetWidth,
        height: totalHeight,
        channels: 3 as const,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite(compositeInputs)
      .png()
      .toBuffer()

    return result.toString('base64')
  }

  // Horizontal: side by side, uniform height
  const targetHeight = Math.min(1024, ...metas.map((m) => m.height || 512))
  const resized = await Promise.all(
    allBuffers.map((buf) =>
      sharp(buf).resize({ height: targetHeight }).png().toBuffer(),
    ),
  )
  const resizedMetas = await Promise.all(
    resized.map((buf) => sharp(buf).metadata()),
  )
  const widths = resizedMetas.map((m) => m.width || 512)
  const totalWidth = widths.reduce((a, b) => a + b, 0)

  let left = 0
  const compositeInputs = resized.map((buf, i) => {
    const input = { input: buf, left, top: 0 }
    left += widths[i]
    return input
  })

  const result = await sharp({
    create: {
      width: totalWidth,
      height: targetHeight,
      channels: 3 as const,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(compositeInputs)
    .png()
    .toBuffer()

  return result.toString('base64')
}

/** Generate a new image via Vertex AI Imagen */
export async function generateWithGoogle(
  options: GoogleGenerateOptions,
): Promise<GoogleImageResult> {
  const ai = getClient()

  const response = await ai.models.generateImages({
    model: 'imagen-4.0-generate-001',
    prompt: options.prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: resolveAspectRatio(options.aspectRatio),
    },
  })

  const image = response.generatedImages?.[0]?.image
  if (!image?.imageBytes) {
    throw new Error('Vertex AI Imagen returned no image data')
  }

  return {
    imageBase64: image.imageBytes,
    mimeType: 'image/png',
  }
}

/** Edit an existing image via Vertex AI Imagen */
export async function editWithGoogle(
  options: GoogleEditOptions,
): Promise<GoogleImageResult> {
  const ai = getClient()

  let referenceBase64 = options.imageBase64
  const prompt = options.prompt

  // When multiple images are provided, composite them into one
  if (options.additionalImagesBase64?.length) {
    referenceBase64 = await compositeImages(
      options.imageBase64,
      options.additionalImagesBase64,
      options.aspectRatio,
    )
  }

  const ref = new RawReferenceImage()
  ref.referenceImage = { imageBytes: referenceBase64 }
  ref.referenceId = 1

  const response = await ai.models.editImage({
    model: 'imagen-3.0-capability-001',
    prompt,
    referenceImages: [ref],
    config: {
      numberOfImages: 1,
      aspectRatio: resolveAspectRatio(options.aspectRatio),
    },
  })

  const image = response.generatedImages?.[0]?.image
  if (!image?.imageBytes) {
    throw new Error('Vertex AI Imagen edit returned no image data')
  }

  return {
    imageBase64: image.imageBytes,
    mimeType: 'image/png',
  }
}
