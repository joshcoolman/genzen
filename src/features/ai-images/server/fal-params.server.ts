/**
 * Central helper to build correct FAL API input params for any model.
 * Uses runtime schema detection to auto-resolve size, safety, and image input params.
 */
import { fetchModelSchema } from './fal-schema.server'
import { RATIO_TO_SIZE } from '#/features/ai-images/constants'
import { fixedParamsFor, imageCapacityFor } from '#/features/ai-images/models'

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

export interface BuiltFalInput {
  input: Record<string, unknown>
  /** How many images the caller offered. */
  imagesRequested: number
  /** How many of them the endpoint could hold, and so how many were sent. */
  imagesUsed: number
}

/**
 * How many images this endpoint takes (#341).
 *
 * The lineup's `imageCapacityFor` is the answer whenever an entry claims the
 * id, because the panel shows that same number -- a cap the submit derived
 * differently would contradict what the picker promised.
 *
 * An endpoint no entry claims (a retired id being retried, or a model wired up
 * to try) falls back to the schema shape: `image_urls` takes as many as it is
 * given, `image_url` takes one, neither takes none. That fallback is the point
 * of the whole change -- an unlisted model behaves, it does not lose every
 * image because no one wrote a number down.
 */
function imageCapacity(
  modelId: string,
  param: 'image_url' | 'image_urls' | null,
): number {
  const known = imageCapacityFor(modelId)
  if (known > 0) return known
  if (param === 'image_urls') return Infinity
  return param === 'image_url' ? 1 : 0
}

export async function buildFalInput(
  opts: BuildFalInputOptions,
): Promise<BuiltFalInput> {
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
    } else {
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

  // Safety params. Both are applied when present: a model exposing a tolerance
  // scale may ALSO run a separate boolean content checker, and leaving that at
  // its default `true` blocks benign prompts regardless of the tolerance set.
  // 'default' → omit both, let FAL decide.
  if (opts.safetyLevel === 'permissive') {
    if (schema.safetyToleranceMax) {
      input.safety_tolerance = schema.safetyToleranceMax
    }
    if (schema.hasSafetyChecker) {
      input.enable_safety_checker = false
    }
  }

  // Image input params.
  //
  // Truncation is explicit and ours, and it is reported back (#341). The panel
  // no longer refuses images past a model's capacity, so this is where a set
  // larger than the endpoint meets the endpoint. It has to be ours rather than
  // FAL's because FAL does not agree with itself about which images survive --
  // FLUX.2 keeps the first four, Seedream keeps the LAST ten -- and a note that
  // says "4 of 6 used" is a lie if the four were not the four we listed.
  const urls = opts.imageUrls ?? (opts.imageUrl ? [opts.imageUrl] : [])
  const sent = urls.slice(
    0,
    imageCapacity(opts.modelId, schema.imageInputParam),
  )
  if (sent.length > 0 && schema.imageInputParam) {
    if (schema.imageInputParam === 'image_urls') {
      input.image_urls = sent
    } else {
      input.image_url = sent[0]
    }
  }

  // Params the lineup pins for this model (#485). Before `extraParams`, so a
  // caller can still override one; after size and safety, because a model that
  // pins a size means it.
  Object.assign(input, fixedParamsFor(opts.modelId))

  // Extra params (num_images, guidance_scale, etc.)
  if (opts.extraParams) {
    Object.assign(input, opts.extraParams)
  }

  return {
    input,
    imagesRequested: urls.length,
    // A schema with no image param takes none, whatever the capacity said.
    imagesUsed: schema.imageInputParam ? sent.length : 0,
  }
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

  return closest
}
