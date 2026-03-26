/**
 * Google image generation via Gemini generateContent with imageConfig.
 * Uses @google/genai SDK. Prefers Gemini API key, falls back to Vertex AI.
 * Supports native aspect ratio control and multiple inline image parts.
 */
import { GoogleGenAI } from '@google/genai'

const GOOGLE_PROJECT = 'gen-lang-client-0015600225'
const GOOGLE_LOCATION = 'us-central1'

/** Map app model IDs to Gemini model names */
const GEMINI_MODEL_MAP: Record<string, string> = {
  'fal-ai/nano-banana-2': 'gemini-2.5-flash-image',
}

/** Aspect ratios generateContent supports natively via imageConfig */
const GEMINI_SUPPORTED_RATIOS = new Set([
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '9:16',
  '16:9',
  '21:9',
])

const RATIO_FALLBACK: Record<string, string> = {
  '5:4': '4:3',
  '4:5': '3:4',
  '2:1': '16:9',
  '1:2': '9:16',
}

function resolveAspectRatio(ratio?: string): string | undefined {
  if (!ratio) return undefined
  if (GEMINI_SUPPORTED_RATIOS.has(ratio)) return ratio
  return RATIO_FALLBACK[ratio] ?? '1:1'
}

function resolveGeminiModel(appModelId: string): string {
  const base = appModelId.replace(/\/edit$/, '')
  return GEMINI_MODEL_MAP[base] ?? 'gemini-2.5-flash-image'
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_AI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (apiKey) {
    return new GoogleGenAI({ apiKey })
  }

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

type ContentPart =
  | { inlineData: { data: string; mimeType: string } }
  | { text: string }

async function callGemini(options: {
  modelId?: string
  prompt: string
  imagesBase64?: Array<string>
  aspectRatio?: string
}): Promise<GoogleImageResult> {
  const ai = getClient()

  const parts: Array<ContentPart> = []

  if (options.imagesBase64?.length) {
    for (const imgB64 of options.imagesBase64) {
      parts.push({
        inlineData: { data: imgB64, mimeType: 'image/png' },
      })
    }
  }

  parts.push({ text: options.prompt })

  const response = await ai.models.generateContent({
    model: resolveGeminiModel(options.modelId ?? 'fal-ai/nano-banana-2'),
    contents: [{ role: 'user', parts }],
    config: {
      responseModalities: ['image', 'text'],
      imageConfig: {
        aspectRatio: resolveAspectRatio(options.aspectRatio),
      },
    },
  })

  // Check for content safety blocks
  if (response.promptFeedback?.blockReason) {
    throw new Error(
      `Gemini blocked the request: ${response.promptFeedback.blockReasonMessage || response.promptFeedback.blockReason}`,
    )
  }

  const candidate = response.candidates?.[0]
  if (!candidate?.content?.parts) {
    throw new Error('Gemini generateContent returned no parts')
  }

  for (const part of candidate.content.parts) {
    if (
      part.inlineData?.data &&
      part.inlineData.mimeType?.startsWith('image/')
    ) {
      return {
        imageBase64: part.inlineData.data,
        mimeType: 'image/png',
      }
    }
  }

  throw new Error('Gemini generateContent returned no image data')
}

/** Generate a new image via Gemini generateContent */
export async function generateWithGoogle(
  options: GoogleGenerateOptions,
): Promise<GoogleImageResult> {
  return callGemini({
    prompt: options.prompt,
    aspectRatio: options.aspectRatio,
  })
}

/** Edit/combine images via Gemini generateContent with inline image parts */
export async function editWithGoogle(
  options: GoogleEditOptions,
): Promise<GoogleImageResult> {
  const images: Array<string> = []
  if (options.imageBase64) images.push(options.imageBase64)
  if (options.additionalImagesBase64)
    images.push(...options.additionalImagesBase64)

  return callGemini({
    prompt: options.prompt,
    imagesBase64: images,
    aspectRatio: options.aspectRatio,
  })
}
