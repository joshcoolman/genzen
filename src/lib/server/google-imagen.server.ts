/**
 * Google image generation via Gemini API's generateContent with IMAGE modality.
 * Uses gemini-2.0-flash-preview-image-generation for text-to-image and image editing.
 * This is the AI Studio / Gemini API path (not Vertex AI).
 */
import { GoogleGenAI } from '@google/genai'

/** Aspect ratios we can request via prompt instruction */
const SUPPORTED_RATIOS = new Set([
  '1:1',
  '3:4',
  '4:3',
  '9:16',
  '16:9',
  '3:2',
  '2:3',
  '5:4',
  '4:5',
  '21:9',
])

/** Map unsupported app ratios to nearest supported ratio */
const RATIO_FALLBACK: Record<string, string> = {
  '2:1': '21:9',
  '1:2': '9:16',
}

function resolveAspectRatio(ratio?: string): string | undefined {
  if (!ratio) return undefined
  if (SUPPORTED_RATIOS.has(ratio)) return ratio
  return RATIO_FALLBACK[ratio] ?? '1:1'
}

const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image'

function getClient(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY environment variable is not set')
  }
  return new GoogleGenAI({ apiKey })
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

/** Extract image data from Gemini generateContent response */
function extractImage(
  response: any,
): { imageBase64: string; mimeType: string } | null {
  const candidates = response?.candidates
  if (!candidates?.length) return null

  for (const candidate of candidates) {
    const parts = candidate.content?.parts
    if (!parts) continue
    for (const part of parts) {
      if (part.inlineData?.data) {
        return {
          imageBase64: part.inlineData.data,
          mimeType: part.inlineData.mimeType ?? 'image/png',
        }
      }
    }
  }
  return null
}

/** Generate a new image via Gemini generateContent with IMAGE modality */
export async function generateWithGoogle(
  options: GoogleGenerateOptions,
): Promise<GoogleImageResult> {
  const ai = getClient()

  const ratio = resolveAspectRatio(options.aspectRatio)
  const ratioInstruction = ratio
    ? ` Generate the image in ${ratio} aspect ratio.`
    : ''

  const response = await ai.models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: `${options.prompt}${ratioInstruction}`,
    config: {
      responseModalities: ['image', 'text'],
    },
  })

  const image = extractImage(response)
  if (!image) {
    throw new Error('Google Gemini returned no image data')
  }

  return image
}

/** Edit an existing image via Gemini generateContent with image input */
export async function editWithGoogle(
  options: GoogleEditOptions,
): Promise<GoogleImageResult> {
  const ai = getClient()

  // Build parts: primary image + additional reference images + prompt text
  const imageParts: Array<{ inlineData: { data: string; mimeType: string } }> =
    [{ inlineData: { data: options.imageBase64, mimeType: 'image/png' } }]
  if (options.additionalImagesBase64?.length) {
    for (const img of options.additionalImagesBase64) {
      imageParts.push({
        inlineData: { data: img, mimeType: 'image/png' },
      })
    }
  }

  const response = await ai.models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: [
      {
        role: 'user',
        parts: [...imageParts, { text: options.prompt }],
      },
    ],
    config: {
      responseModalities: ['image', 'text'],
    },
  })

  const image = extractImage(response)
  if (!image) {
    throw new Error('Google Gemini edit returned no image data')
  }

  return image
}
