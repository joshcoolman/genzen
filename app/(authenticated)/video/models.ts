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
  /** No first frame: the model invents the whole shot from the prompt. */
  textToVideo: string
  /** A first frame is set. The only mode that takes an end frame. */
  withImage: string
  /** Cents per second of output, at the resolution below. */
  pricePerSecondCents: number
  resolution: string
  durations: Array<number>
  defaultDuration: number
  /**
   * Per mode, because the endpoints genuinely differ: `auto` exists only where
   * there is an image to match. With a first frame, 16:9 and 9:16 mean "recrop
   * my picture" -- which crops and re-imagines, and is why `auto` is the
   * default there. With no first frame they are just the output shape.
   */
  aspectRatios: { textToVideo: Array<string>; withImage: Array<string> }
  /** Takes an `end_image_url`: two stills in, the transition between them out.
   *  Only meaningful with a first frame -- there is no end without a start. */
  supportsEndImage: boolean
}

export const VIDEO_MODELS: Array<VideoModel> = [
  {
    slug: 'ltx-2.5-fast',
    label: 'LTX-2.5 Fast',
    description: 'Image to video with native synchronized audio',
    textToVideo: 'lightricks/ltx-2.5/text-to-video/fast',
    withImage: 'lightricks/ltx-2.5/image-to-video/fast',
    // $0.09/s at 720p. 1080p is $0.13 and 1440p/2160p higher, so a resolution
    // control has to move this number with it -- which is why V1 has neither.
    pricePerSecondCents: 9,
    resolution: '720p',
    durations: [6, 8, 10, 12, 14, 16, 18, 20],
    defaultDuration: 8,
    aspectRatios: {
      textToVideo: ['16:9', '9:16'],
      withImage: ['auto', '16:9', '9:16'],
    },
    supportsEndImage: true,
  },
]

export const DEFAULT_VIDEO_MODEL = VIDEO_MODELS[0]

export function videoModelBySlug(slug: string): VideoModel | undefined {
  return VIDEO_MODELS.find((m) => m.slug === slug)
}

/** The endpoint for this request, picked by whether a first frame is set --
 *  the same shape `IMAGE_MODELS` uses for `textToImage` / `withImages`. */
export function endpointFor(model: VideoModel, hasFirstFrame: boolean): string {
  return hasFirstFrame ? model.withImage : model.textToVideo
}

export function aspectRatiosFor(
  model: VideoModel,
  hasFirstFrame: boolean,
): Array<string> {
  return hasFirstFrame
    ? model.aspectRatios.withImage
    : model.aspectRatios.textToVideo
}

/** What a clip of this length will cost, in cents. */
export function estimateCostCents(model: VideoModel, duration: number): number {
  return Math.round(model.pricePerSecondCents * duration)
}

export function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
