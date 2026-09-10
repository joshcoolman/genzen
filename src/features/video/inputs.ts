import { z } from 'zod'
import {
  endpointFor,
  estimateCostCents,
  resolutionFor,
  resolutionsFor,
} from './models'
import type { VideoEndpoint, VideoModel } from './models'

export const VIDEO_IMAGE_ROLES = ['first', 'reference', 'last'] as const
export type VideoImageRole = (typeof VIDEO_IMAGE_ROLES)[number]
export interface VideoImageInput {
  id: string
  role: VideoImageRole
}

export const MAX_VIDEO_IMAGES = 9

export const videoImagesSchema = z
  .array(
    z.object({
      id: z.string().uuid(),
      role: z.enum(VIDEO_IMAGE_ROLES),
    }),
  )
  .max(MAX_VIDEO_IMAGES)

/** Uses the entire selection. No truncation and no text-only fallback. */
export function imageCompatibility(
  model: VideoModel,
  images: Array<VideoImageInput>,
): string | null {
  const first = images.filter((i) => i.role === 'first')
  const last = images.filter((i) => i.role === 'last')
  const refs = images.filter((i) => i.role === 'reference')
  if (images.some((i) => !VIDEO_IMAGE_ROLES.includes(i.role)))
    return 'Unknown image role'
  if (images.length > MAX_VIDEO_IMAGES)
    return `Add up to ${MAX_VIDEO_IMAGES} images`
  if (first.length > 1) return 'Choose only one first frame'
  if (last.length > 1) return 'Choose only one last frame'
  if (new Set(images.map((i) => i.id)).size !== images.length)
    return 'Each image can be added only once'
  if (refs.length > 0) {
    const endpoint = model.endpoints.withReferences
    if (!endpoint?.references) return 'Does not accept reference images'
    if (refs.length > endpoint.references.max)
      return `Up to ${endpoint.references.max} reference images here`
    if (
      (first.length && !endpoint.firstFrameParam) ||
      (last.length && !endpoint.acceptsEndImage)
    ) {
      return 'Use references or frames, not both'
    }
    if (last.length && !first.length && !endpoint.acceptsEndOnly)
      return 'A last frame needs a first frame'
    return null
  }
  try {
    endpointFor(model, first.length > 0, last.length > 0)
    return null
  } catch (error) {
    return error instanceof Error
      ? error.message
      : 'Unsupported image combination'
  }
}

export function endpointForImages(
  model: VideoModel,
  images: Array<VideoImageInput>,
): VideoEndpoint {
  const error = imageCompatibility(model, images)
  if (error) throw new Error(error)
  if (images.some((i) => i.role === 'reference'))
    return model.endpoints.withReferences!
  return endpointFor(
    model,
    images.some((i) => i.role === 'first'),
    images.some((i) => i.role === 'last'),
  )
}

/** Preserve a compatible choice. Input changes can narrow to another model,
 * but never change or delete the input to accommodate a model. */
export function compatibleModel(
  models: Array<VideoModel>,
  preferredSlug: string,
  images: Array<VideoImageInput>,
): VideoModel | undefined {
  return (
    models.find(
      (m) => m.slug === preferredSlug && !imageCompatibility(m, images),
    ) ?? models.find((m) => !imageCompatibility(m, images))
  )
}

export function referenceLabel(
  endpoint: VideoEndpoint | undefined,
  index: number,
): string {
  return `${endpoint?.references?.notation ?? 'Image '}${index + 1}`
}

export function estimateVideoCost(
  model: VideoModel,
  duration: number,
  resolution: string | undefined,
  images: Array<VideoImageInput>,
): number {
  const refs = model.endpoints.withReferences?.references
  const count = images.filter((i) => i.role === 'reference').length
  const surcharge = refs
    ? Math.max(0, count - (refs.includedInPrice ?? count)) *
      (refs.extraImageCents ?? 0)
    : 0
  return estimateCostCents(model, duration, resolution) + surcharge
}

/** All validation happens before reservation, storage uploads or a paid call. */
export function videoRequestPlan(
  model: VideoModel,
  images: Array<VideoImageInput>,
  prompt: string,
  duration: number,
  aspectRatio: string,
  resolution?: string,
) {
  const endpoint = endpointForImages(model, images)
  const trimmed = prompt.trim()
  if (!trimmed) throw new Error('A prompt is required')
  if (endpoint.maxPromptLength && trimmed.length > endpoint.maxPromptLength)
    throw new Error(
      `This model accepts up to ${endpoint.maxPromptLength} prompt characters`,
    )
  if (!model.durations.includes(duration))
    throw new Error(`Unsupported duration: ${duration}`)
  if (
    endpoint.aspectRatios.length &&
    !endpoint.aspectRatios.includes(aspectRatio)
  )
    throw new Error(`Unsupported aspect ratio: ${aspectRatio}`)
  const sentResolution = resolutionFor(model, resolution)
  if (
    resolution &&
    resolutionsFor(model).length &&
    resolution !== sentResolution
  )
    throw new Error(`Unsupported resolution: ${resolution}`)
  return {
    endpoint,
    prompt: trimmed,
    resolution: sentResolution,
    estimatedCostCents: estimateVideoCost(
      model,
      duration,
      sentResolution,
      images,
    ),
  }
}

/** URLs remain aligned with the submitted image order, including end-only
 * requests. Reference numbering ignores first/last frames. */
export function videoFalInput(
  endpoint: VideoEndpoint,
  images: Array<VideoImageInput>,
  urls: Array<string>,
  settings: {
    prompt: string
    duration: number
    aspectRatio: string
    resolution: string
    supportsAudio: boolean
  },
): Record<string, unknown> {
  if (urls.length !== images.length || urls.some((url) => !url))
    throw new Error('An image could not be uploaded')
  const urlFor = (role: VideoImageRole) =>
    urls[images.findIndex((i) => i.role === role)]
  const first = urlFor('first')
  const last = urlFor('last')
  const refs = images.flatMap((i, index) =>
    i.role === 'reference' ? [urls[index]] : [],
  )
  return {
    ...endpoint.defaults,
    prompt: settings.prompt,
    duration: endpoint.durationAsString
      ? String(settings.duration)
      : settings.duration,
    ...(endpoint.aspectRatios.length
      ? { aspect_ratio: settings.aspectRatio }
      : {}),
    ...(!endpoint.omitResolution ? { resolution: settings.resolution } : {}),
    ...(settings.supportsAudio ? { generate_audio: true } : {}),
    ...(first && endpoint.firstFrameParam
      ? { [endpoint.firstFrameParam]: first }
      : {}),
    ...(last && endpoint.acceptsEndImage ? { end_image_url: last } : {}),
    ...(refs.length && endpoint.references
      ? { [endpoint.references.param]: refs }
      : {}),
  }
}
