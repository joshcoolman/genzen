/**
 * The video lineup (#305). One entry per model, and the only place to add or
 * remove one -- the form is driven off the record rather than hardcoding a
 * duration list, so a second model is a literal here and nothing else.
 *
 * Route-owned on purpose: `src/features/` is earned by two consumers and this
 * has one. Promote it the day Canvas wants to animate a card.
 *
 * Endpoint ids verified against https://fal.ai/models -- note the `lightricks/`
 * namespace, not `fal-ai/`.
 */
export interface VideoModel {
  /** Stable identity. Never sent to FAL. */
  slug: string
  label: string
  description: string
  endpoint: string
  /** Cents per second of output, at the resolution below. */
  pricePerSecondCents: number
  resolution: string
  durations: Array<number>
  defaultDuration: number
  aspectRatios: Array<string>
  /** Takes an `end_image_url`: two stills in, the transition between them out. */
  supportsEndImage: boolean
}

export const VIDEO_MODELS: Array<VideoModel> = [
  {
    slug: 'ltx-2.5-fast',
    label: 'LTX-2.5 Fast',
    description: 'Image to video with native synchronized audio',
    endpoint: 'lightricks/ltx-2.5/image-to-video/fast',
    // $0.09/s at 720p. 1080p is $0.13 and 1440p/2160p higher, so a resolution
    // control has to move this number with it -- which is why V1 has neither.
    pricePerSecondCents: 9,
    resolution: '720p',
    durations: [6, 8, 10, 12, 14, 16, 18, 20],
    defaultDuration: 8,
    aspectRatios: ['auto', '16:9', '9:16'],
    supportsEndImage: true,
  },
]

export const DEFAULT_VIDEO_MODEL = VIDEO_MODELS[0]

export function videoModelBySlug(slug: string): VideoModel | undefined {
  return VIDEO_MODELS.find((m) => m.slug === slug)
}

/** What a clip of this length will cost, in cents. */
export function estimateCostCents(model: VideoModel, duration: number): number {
  return Math.round(model.pricePerSecondCents * duration)
}

export function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
