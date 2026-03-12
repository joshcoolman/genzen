/**
 * Central helper to build correct FAL API input params for any model.
 * Uses runtime schema detection to auto-resolve size, safety, and image input params.
 */
import { fetchModelSchema } from './fal-schema.server'
import { RATIO_TO_SIZE } from '@/features/ai-images/constants'

// Maps our aspect ratios to resolution strings for models like GPT Image 1.5
// that accept a fixed enum of "WIDTHxHEIGHT" values
const RATIO_TO_RESOLUTION: Record<string, string> = {
  '1:1': '1024x1024',
  '3:2': '1536x1024',
  '16:9': '1536x1024',
  '4:3': '1536x1024',
  '2:1': '1536x1024',
  '21:9': '1536x1024',
  '5:4': '1536x1024',
  '2:3': '1024x1536',
  '9:16': '1024x1536',
  '3:4': '1024x1536',
  '1:2': '1024x1536',
  '4:5': '1024x1536',
}

export interface BuildFalInputOptions {
  modelId: string
  prompt: string
  aspectRatio?: string
  imageUrl?: string
  imageUrls?: Array<string>
  safetyLevel?: 'permissive' | 'default'
  extraParams?: Record<string, unknown>
}

export async function buildFalInput(
  opts: BuildFalInputOptions,
): Promise<Record<string, unknown>> {
  const schema = await fetchModelSchema(opts.modelId)

  const input: Record<string, unknown> = {
    prompt: opts.prompt,
  }

  // Size params
  if (opts.aspectRatio && schema.sizeParam) {
    if (schema.sizeParam === 'aspect_ratio') {
      input.aspect_ratio = schema.aspectRatioEnumValues
        ? findClosestRatio(opts.aspectRatio, schema.aspectRatioEnumValues)
        : opts.aspectRatio
    } else if (schema.sizeParam === 'image_size') {
      if (isResolutionEnum(schema.imageSizeEnumValues)) {
        // Models with fixed resolution strings (GPT Image 1.5) — check first
        // since anyOf schemas may also advertise an ImageSize $ref
        input.image_size = RATIO_TO_RESOLUTION[opts.aspectRatio] ?? '1024x1024'
      } else if (schema.imageSizeAcceptsObject) {
        // Models that accept {width, height} objects (FLUX, Qwen, etc.)
        input.image_size =
          RATIO_TO_SIZE[opts.aspectRatio] ?? RATIO_TO_SIZE['1:1']
      } else {
        // Named size enum (square_hd, landscape_4_3, etc.) — fall back to object
        input.image_size =
          RATIO_TO_SIZE[opts.aspectRatio] ?? RATIO_TO_SIZE['1:1']
      }
    }
  }

  // Safety params
  if (schema.safetyParam === 'safety_tolerance') {
    if (opts.safetyLevel === 'permissive' && schema.safetyToleranceMax) {
      input.safety_tolerance = schema.safetyToleranceMax
    }
    // 'default' → omit, let FAL use its default
  } else if (schema.safetyParam === 'enable_safety_checker') {
    if (opts.safetyLevel === 'permissive') {
      input.enable_safety_checker = false
    }
  }

  // Image input params
  const urls = opts.imageUrls ?? (opts.imageUrl ? [opts.imageUrl] : [])
  if (urls.length > 0 && schema.imageInputParam) {
    if (schema.imageInputParam === 'image_urls') {
      input.image_urls = urls
    } else {
      input.image_url = urls[0]
    }
  }

  // Extra params (num_images, guidance_scale, etc.)
  if (opts.extraParams) {
    Object.assign(input, opts.extraParams)
  }

  return input
}

function isResolutionEnum(values?: Array<string>): boolean {
  if (!values?.length) return false
  // Resolution enums contain "WIDTHxHEIGHT" patterns like "1024x1024"
  return values.some((v) => /^\d+x\d+$/.test(v))
}

function parseRatioValue(ratio: string): number | null {
  const parts = ratio.split(':')
  if (parts.length !== 2) return null
  const [a, b] = parts.map(Number)
  if (!a || !b) return null
  return a / b
}

function findClosestRatio(
  requested: string,
  validRatios: Array<string>,
): string {
  if (validRatios.includes(requested)) return requested

  const requestedValue = parseRatioValue(requested)
  if (requestedValue === null) return validRatios[0] ?? requested

  let closest = validRatios[0]
  let closestDiff = Infinity

  for (const ratio of validRatios) {
    const value = parseRatioValue(ratio)
    if (value === null) continue
    const diff = Math.abs(value - requestedValue)
    if (diff < closestDiff) {
      closestDiff = diff
      closest = ratio
    }
  }

  return closest ?? requested
}
