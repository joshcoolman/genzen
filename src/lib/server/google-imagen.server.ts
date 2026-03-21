/**
 * Google Imagen via Vertex AI (native generateImages/editImage with aspectRatio).
 * Uses @google/genai SDK in Vertex AI mode with service account auth.
 * Requires GOOGLE_APPLICATION_CREDENTIALS env var pointing to service account JSON key.
 */
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
    // Deploy (Fly.io): service account JSON stored as env var
    opts.googleAuthOptions = {
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    }
  }
  // Local dev: GOOGLE_APPLICATION_CREDENTIALS file path auto-discovered by SDK

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

  // Imagen editImage only accepts a single raw reference image
  const primaryRef = new RawReferenceImage()
  primaryRef.referenceImage = { imageBytes: options.imageBase64 }
  primaryRef.referenceId = 1
  const referenceImages: Array<RawReferenceImage> = [primaryRef]

  const response = await ai.models.editImage({
    model: 'imagen-3.0-capability-001',
    prompt: options.prompt,
    referenceImages,
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
