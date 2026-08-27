/**
 * The video lineup (#305, #385). One entry per model, and the only place to add
 * or remove one -- the form and the submit are both driven off the record.
 *
 * Route-owned on purpose: `src/features/` is earned by two consumers and this
 * has one. Promote it the day Canvas wants to animate a card.
 *
 * **A mode is an endpoint, and an endpoint is a descriptor, not an id** (#385).
 * The three models here disagree about more than their names:
 *
 *   - Flux 3 puts first+last frame on a *separate* endpoint, which requires
 *     both frames and calls the first one `start_image_url`. LTX and H3 take
 *     an optional `end_image_url` on their ordinary image endpoint.
 *   - MiniMax H3's image endpoint has no `aspect_ratio` at all -- the output
 *     follows the image -- so there is no control to show, which is a
 *     different thing from a list with one option in it.
 *   - `generate_audio` is Flux 3 and LTX only.
 *
 * So each endpoint carries what it takes, and `generate-video.action.ts` builds
 * its input from that rather than from a fixed list of params. Same idea as the
 * image side's `buildFalInput`, minus the schema fetch: this lineup is three
 * entries and every field below was read off FAL's OpenAPI spec by hand.
 *
 * Endpoint ids verified against https://fal.ai/models -- note the `lightricks/`,
 * `blackforestlabs/` and `minimax/` namespaces, none of them `fal-ai/`.
 */
export interface VideoEndpoint {
  id: string
  /**
   * The param carrying the first frame. Absent on a text-to-video endpoint,
   * which takes no image at all.
   */
  firstFrameParam?: 'image_url' | 'start_image_url'
  /** Takes an `end_image_url` alongside the first frame. */
  acceptsEndImage?: boolean
  /**
   * What this endpoint offers. **Empty means there is no control**, not that
   * every ratio works: H3's image endpoint has no `aspect_ratio` param, and
   * sending one is how you find out.
   */
  aspectRatios: Array<string>
}

export interface VideoModel {
  /** Stable identity. Never sent to FAL. */
  slug: string
  label: string
  description: string
  endpoints: {
    /** No first frame: the model invents the whole shot from the prompt. */
    textToVideo: VideoEndpoint
    /** A first frame is set. */
    withImage: VideoEndpoint
    /**
     * Both frames, where that is its own endpoint. Absent means the end frame
     * rides on `withImage` -- which is the common case, and Flux 3 the
     * exception that forced the slot to exist.
     */
    withFirstAndLastImage?: VideoEndpoint
  }
  /** Cents per second of output, at the resolution below. */
  pricePerSecondCents: number
  resolution: string
  durations: Array<number>
  defaultDuration: number
  /** Sends `generate_audio`. H3 has no such param. */
  supportsAudio: boolean
}

export const VIDEO_MODELS: Array<VideoModel> = [
  {
    slug: 'ltx-2.5-fast',
    label: 'LTX-2.5 Fast',
    description: 'Native synchronized audio, cheap',
    endpoints: {
      textToVideo: {
        id: 'lightricks/ltx-2.5/text-to-video/fast',
        aspectRatios: ['16:9', '9:16'],
      },
      withImage: {
        id: 'lightricks/ltx-2.5/image-to-video/fast',
        firstFrameParam: 'image_url',
        acceptsEndImage: true,
        // `auto` exists only where there is an image to match. 16:9 and 9:16
        // here mean "recrop my picture", which crops and re-imagines -- which
        // is why `auto` leads.
        aspectRatios: ['auto', '16:9', '9:16'],
      },
    },
    // $0.09/s at 720p. 1080p is $0.13 and 1440p/2160p higher, so a resolution
    // control has to move this number with it -- which is why there is none.
    pricePerSecondCents: 9,
    resolution: '720p',
    durations: [6, 8, 10, 12, 14, 16, 18, 20],
    defaultDuration: 8,
    supportsAudio: true,
  },
  {
    slug: 'minimax-h3',
    label: 'MiniMax H3',
    description: 'Cheapest per second, follows the first frame',
    endpoints: {
      textToVideo: {
        id: 'minimax/h3/text-to-video',
        aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
      },
      withImage: {
        id: 'minimax/h3/image-to-video',
        firstFrameParam: 'image_url',
        acceptsEndImage: true,
        // Empty deliberately: this endpoint has no `aspect_ratio` param. FAL's
        // own note is "the output aspect ratio follows this image", so there
        // is nothing to choose and the form shows no pills.
        aspectRatios: [],
      },
    },
    // **6, from FAL's own invoice, not 8 from its rate card.** FAL bills this
    // endpoint at $0.05 per second but on 1.2x the requested duration -- an 8s
    // clip was charged 9.6 seconds, $0.48. That is 6c per second of clip you
    // asked for, and it is the number worth showing, since the duration control
    // is what a person is actually choosing. At 8 the estimate ran a third
    // over. (Flux 3 bills 2x duration at $0.085 and LTX 9 units at $0.01, so
    // their 17 and 9 were already right.)
    pricePerSecondCents: 6,
    resolution: '768P',
    // FAL gives a range (5-15) rather than an enum, and a 7 was accepted; this
    // is a spread across it rather than a constraint FAL stated.
    durations: [5, 6, 8, 10, 12, 15],
    defaultDuration: 6,
    supportsAudio: false,
  },
  {
    slug: 'flux-3',
    label: 'Flux 3',
    description: 'Black Forest Labs, widest aspect range',
    endpoints: {
      textToVideo: {
        id: 'blackforestlabs/flux-3/text-to-video',
        // `auto` is in FAL's enum for every Flux 3 mode, but with no image it
        // has nothing to match, so it is not offered here.
        aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '2:1', '21:9'],
      },
      withImage: {
        id: 'blackforestlabs/flux-3/image-to-video',
        firstFrameParam: 'image_url',
        // Its own `image-to-video` endpoint takes no end frame; the endpoint
        // below is what does.
        aspectRatios: [
          'auto',
          '16:9',
          '9:16',
          '1:1',
          '4:3',
          '3:4',
          '2:1',
          '21:9',
        ],
      },
      withFirstAndLastImage: {
        id: 'blackforestlabs/flux-3/first-last-frame-to-video',
        // Not `image_url`. This is the whole reason an endpoint is a
        // descriptor rather than a string.
        firstFrameParam: 'start_image_url',
        acceptsEndImage: true,
        aspectRatios: [
          'auto',
          '16:9',
          '9:16',
          '1:1',
          '4:3',
          '3:4',
          '2:1',
          '21:9',
        ],
      },
    },
    // $0.17/s at 720p, $0.29 at 1080p -- nearly twice LTX either way.
    pricePerSecondCents: 17,
    resolution: '720p',
    durations: [5, 6, 8, 10, 12, 16, 20],
    defaultDuration: 8,
    supportsAudio: true,
  },
]

export const DEFAULT_VIDEO_MODEL = VIDEO_MODELS[0]

export function videoModelBySlug(slug: string): VideoModel | undefined {
  return VIDEO_MODELS.find((m) => m.slug === slug)
}

/**
 * Cheapest first, which is what the picker renders.
 *
 * The same rule the image lineup follows (`byPrice` in
 * `model-selector/unified-models.ts`, #341): the array's own order is the order
 * models were added, which says nothing, and price is the one axis worth
 * reading down a column. It matters more here than it does there -- the spread
 * is $0.08 to $0.17 per *second*, so the bottom of the list is twice the top
 * for the same clip.
 *
 * Display only. `DEFAULT_VIDEO_MODEL` is still the array's first entry, exactly
 * as the image side keeps its default independent of the sorted view: what you
 * start on is a judgement about quality, not a race to the cheapest.
 */
export function videoModelsByPrice(): Array<VideoModel> {
  return [...VIDEO_MODELS].sort(
    (a, b) => a.pricePerSecondCents - b.pricePerSecondCents,
  )
}

/**
 * The endpoint this request goes to, and what it takes.
 *
 * Three modes, not two: a model may put first+last frame somewhere else
 * entirely. Where it does not, the end frame rides on the image endpoint and
 * this returns that one for both.
 */
export function endpointFor(
  model: VideoModel,
  hasFirstFrame: boolean,
  hasLastFrame = false,
): VideoEndpoint {
  if (!hasFirstFrame) return model.endpoints.textToVideo
  if (hasLastFrame && model.endpoints.withFirstAndLastImage) {
    return model.endpoints.withFirstAndLastImage
  }
  return model.endpoints.withImage
}

/**
 * Whether this model can take an end frame at all, in any mode. Drives the
 * second slot's presence in the form -- a slot that cannot be sent anywhere is
 * worse than no slot.
 */
export function supportsEndImage(model: VideoModel): boolean {
  return (
    !!model.endpoints.withFirstAndLastImage ||
    !!model.endpoints.withImage.acceptsEndImage
  )
}

/**
 * How many frames this model holds in this mode: 1, or 2 where an end frame is
 * accepted. The picker's capacity column, and what dims a row against a staged
 * pair.
 */
export function frameCapacityFor(model: VideoModel): number {
  return supportsEndImage(model) ? 2 : 1
}

export function aspectRatiosFor(
  model: VideoModel,
  hasFirstFrame: boolean,
  hasLastFrame = false,
): Array<string> {
  return endpointFor(model, hasFirstFrame, hasLastFrame).aspectRatios
}

/** What a clip of this length will cost, in cents. */
export function estimateCostCents(model: VideoModel, duration: number): number {
  return Math.round(model.pricePerSecondCents * duration)
}

export function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * How long a clip actually runs, in seconds.
 *
 * Two figures can be on the row and they are not the same claim.
 * `duration_seconds` is written at submit time from the request params -- what
 * was asked for, and what `estimateCostCents` priced. `measured_duration_seconds`
 * is read off the file by ffprobe at ingest (#499) -- what arrived. They
 * disagree in practice: MiniMax bills on 1.2x the requested duration, per the
 * note in this file's catalog.
 *
 * The measured figure wins where there is one. Every clip made before #499 has
 * only the requested figure, and no backfill has been run, so the fallback is
 * the common case rather than a guard against a missing key.
 *
 * Takes the metadata bag rather than a row: `VideoRecord` is declared by a
 * route action and this module is headless, so it may not name that type.
 */
export function clipDurationSeconds(clip: {
  generation_metadata?: Record<string, unknown> | null
}): number | null {
  const meta = clip.generation_metadata ?? {}
  const measured = meta.measured_duration_seconds
  if (typeof measured === 'number') return Math.round(measured)
  const requested = meta.duration_seconds
  return typeof requested === 'number' ? requested : null
}

/**
 * Every endpoint id a row of this model can carry.
 *
 * A row's `generation_metadata.model` is the *endpoint* it was submitted to,
 * and one model owns two or three of them. Anything that reasons about rows by
 * model -- naming one, filtering for one -- has to expand through this.
 */
export function videoEndpointIds(model: VideoModel): Array<string> {
  const { textToVideo, withImage, withFirstAndLastImage } = model.endpoints
  const ids = [textToVideo.id, withImage.id]
  if (withFirstAndLastImage) ids.push(withFirstAndLastImage.id)
  return ids
}

const ENDPOINT_LABELS = new Map<string, string>(
  VIDEO_MODELS.flatMap((m) => videoEndpointIds(m).map((id) => [id, m.label])),
)

/**
 * The model's name for an endpoint id, or undefined if no model claims it.
 *
 * Undefined rather than the raw id, so a caller can fall back to the image
 * lineup instead of being handed a string that looks like an answer.
 */
export function videoModelNameFor(endpointId: string): string | undefined {
  return ENDPOINT_LABELS.get(endpointId)
}

/**
 * The prefix marking a filter option as "this whole video model" (#398).
 *
 * Activity's model filter is one row per model, matching the picker, but a
 * video model is two or three endpoints in the data. Rather than list them
 * separately -- which would split one model across three unreadable rows -- an
 * option carries the slug and the query expands it with `expandVideoFilterId`.
 * Prefixed because the same array holds raw image endpoint ids, and a slug like
 * `flux-3` next to `fal-ai/flux-pro/kontext` needs to be distinguishable.
 */
export const VIDEO_FILTER_PREFIX = 'video:'

/** One option per model, for a filter that lists models rather than endpoints. */
export function videoFilterOptions(): Array<{ id: string; label: string }> {
  return videoModelsByPrice().map((m) => ({
    id: `${VIDEO_FILTER_PREFIX}${m.slug}`,
    label: m.label,
  }))
}

/**
 * A filter id back to the endpoint ids it stands for.
 *
 * Null for anything that is not one of ours, so a caller can pass the id
 * through untouched -- an image endpoint id already *is* what the column holds.
 */
export function expandVideoFilterId(id: string): Array<string> | null {
  if (!id.startsWith(VIDEO_FILTER_PREFIX)) return null
  const model = videoModelBySlug(id.slice(VIDEO_FILTER_PREFIX.length))
  return model ? videoEndpointIds(model) : []
}

/**
 * Durations every one of these models accepts.
 *
 * A real intersection, because a duration one model rejects is a request that
 * fails at FAL rather than here (#417). LTX starts at 6 and steps to 20, H3
 * runs 5-15, Flux 3 tops out at 20 -- so ticking all three narrows the control
 * rather than offering a number that will bounce for one of them.
 *
 * Never empty for the current lineup, but a caller must still cope: adding a
 * model whose durations do not overlap the others would empty it, and a
 * silently empty control is worse than a visible clash.
 */
export function sharedDurations(models: Array<VideoModel>): Array<number> {
  // `.at(0)` rather than a destructure: destructuring types the element as
  // always present, so the empty-list guard below reads as dead code and lint
  // fails it. `.at` is honest about an empty array.
  const first = models.at(0)
  if (!first) return []
  const rest = models.slice(1)
  return first.durations.filter((d) =>
    rest.every((m) => m.durations.includes(d)),
  )
}

/**
 * Aspect ratios every one of these models offers, **ignoring the ones that
 * offer none**.
 *
 * The exclusion is the whole subtlety. H3's image endpoint has no
 * `aspect_ratio` param at all, and an empty list means "there is no control"
 * rather than "no ratio works" -- so intersecting it literally would strip the
 * control from LTX and Flux 3 as well, silently handing FAL its default for two
 * models that were perfectly capable of honouring a choice. The submit already
 * omits the param per endpoint, so a model with no options simply does not
 * receive one.
 */
export function sharedAspectRatios(
  models: Array<VideoModel>,
  hasFirstFrame: boolean,
  hasLastFrame = false,
): Array<string> {
  const lists = models
    .map((m) => aspectRatiosFor(m, hasFirstFrame, hasLastFrame))
    .filter((list) => list.length > 0)
  const first = lists.at(0)
  if (!first) return []
  const rest = lists.slice(1)
  return first.filter((ratio) => rest.every((list) => list.includes(ratio)))
}

/**
 * What this submit costs, in cents: every selected model, once each.
 *
 * **One clip per model, never more** (#417). The image panel's count stepper is
 * deliberately absent here -- video is slow and finicky enough that nobody
 * wants four takes of one request from one model, and the useful axis is across
 * models rather than within one.
 */
export function estimateMultiCostCents(
  models: Array<VideoModel>,
  duration: number,
  clipsPerModel: number,
): number {
  return models.reduce(
    (total, m) => total + estimateCostCents(m, duration) * clipsPerModel,
    0,
  )
}
