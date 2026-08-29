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
 * its input from that rather than from a fixed list of params.
 *
 * **One model at a time, and it gets its whole capability.** Multi-select
 * (#417) forced every control down to what all the ticked models agreed on --
 * an intersection of durations, of aspect ratios, and it would have been an
 * intersection of resolutions too. That is tolerable on the image side, where
 * the models mostly agree; here they disagree about almost everything, so the
 * common denominator kept shrinking as the lineup grew and the differences
 * between these models -- which are the reason to have more than one -- became
 * the exact thing the form could not express. Single-select is what lets a
 * model offer what only it can: h3-max's resolution tiers, Flux 3's
 * first+last endpoint, an audio toggle for the two that generate it. Do not
 * reintroduce a `shared*` intersection helper. Same idea as the
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

/**
 * A resolution a model offers, and what it costs there.
 *
 * Only for a model that lets you choose. The other three carry a fixed
 * `resolution` string and a single `pricePerSecondCents`, because a control
 * with one option would say a choice exists and had been taken away -- the
 * same rule `aspectRatios: []` follows.
 */
export interface VideoResolution {
  /** Sent verbatim as `resolution`. FAL's casing, not ours: `480P`, not `480p`. */
  id: string
  pricePerSecondCents: number
}

export interface VideoModel {
  /** Stable identity. Never sent to FAL. */
  slug: string
  label: string
  description: string
  endpoints: {
    /** No first frame: the model invents the whole shot from the prompt. */
    textToVideo: VideoEndpoint
    /**
     * A first frame is set. **Optional**: a text-to-video-only model has no
     * such endpoint, and a staged frame is ignored for it rather than
     * refused. The route is multi-select, so throwing would fail the whole
     * submit -- including the models that could have used the frame.
     */
    withImage?: VideoEndpoint
    /**
     * Both frames, where that is its own endpoint. Absent means the end frame
     * rides on `withImage` -- which is the common case, and Flux 3 the
     * exception that forced the slot to exist.
     */
    withFirstAndLastImage?: VideoEndpoint
  }
  /**
   * Cents per second of output, at the resolution below -- and where
   * `resolutions` is set, at whichever of them `resolution` names. Kept as the
   * model's headline price so `videoModelsByPrice` has one number to sort on.
   */
  pricePerSecondCents: number
  /** The default resolution, and the one a model with no choice always uses. */
  resolution: string
  /**
   * Every resolution this model offers, where it offers more than one.
   * **Empty/absent means there is no control**, exactly as with `aspectRatios`
   * -- not that the model renders at one size by physics, but that we do not
   * expose the choice. Present only on h3-max today; LTX and Flux 3 both have
   * higher tiers that would belong here the day their per-tier prices are
   * confirmed.
   */
  resolutions?: Array<VideoResolution>
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
  {
    slug: 'minimax-h3-max',
    label: 'MiniMax H3 Max',
    description: 'Text only, follows a long prompt closely',
    endpoints: {
      // **The only entry with no `withImage`.** A post-trained H3 tuned for
      // prompt adherence, and fal ships it text-to-video only. That is the
      // reason it is here: the multi-shot writer in
      // `src/lib/prompts/multi-shot/` produces a shot-by-shot script whose
      // whole value is whether the model honours the order, and adherence is
      // the axis this variant was tuned on. A staged first frame is ignored
      // for this model, not refused -- see `endpointFor`.
      textToVideo: {
        id: 'minimax/h3-max/text-to-video',
        aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
      },
    },
    // **Rate-card numbers, not invoice numbers, and that distinction has
    // already bitten this exact model family once** -- see H3 above, where
    // fal's card said $0.05/s and the bill came in on 1.2x the requested
    // duration. If h3-max bills the same way these are 6 and 9.6. First
    // invoice settles it; until then the estimate may read low.
    //
    // These are also the *regular* rates. fal ran a 50%-off promotion ($0.025
    // and $0.04) that ends 2026-09-01, so encoding the promotional price would
    // have been wrong within the week.
    pricePerSecondCents: 5,
    resolution: '480P',
    resolutions: [
      { id: '480P', pricePerSecondCents: 5 },
      { id: '768P', pricePerSecondCents: 8 },
    ],
    // fal's schema types `duration` as a plain integer with no enum, so this
    // is H3's accepted range rather than a list fal stated. Same family, and
    // the intersection in `sharedDurations` is only as good as the narrowest
    // honest list -- inventing a wider one here would queue submits that bounce
    // at fal.
    durations: [5, 6, 8, 10, 12, 15],
    defaultDuration: 6,
    // No `generate_audio` param, same as H3.
    supportsAudio: false,
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
 * is $0.05 to $0.17 per *second*, so the bottom of the list is three times the
 * top for the same clip.
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
  // **A model with no image endpoint falls back to text-to-video rather than
  // failing.** h3-max takes no frame at all. Frames are staged before a model
  // is picked as often as after, so refusing here would turn an ordinary
  // switch into an error the person has to undo by clearing work they may
  // still want for the next model. The form hides the slots for such a model
  // (`takesFirstFrame`), which is where the person is told -- this is the
  // backstop, not the message.
  return model.endpoints.withImage ?? model.endpoints.textToVideo
}

/**
 * Whether a staged first frame reaches this model at all.
 *
 * False only for a text-to-video-only entry, whose clip is generated from the
 * prompt alone however many frames are staged. Drives the form's note and the
 * row's `generationType`, so a clip is never recorded as `image_to_video` when
 * no image was sent.
 */
export function takesFirstFrame(model: VideoModel): boolean {
  return !!model.endpoints.withImage
}

/**
 * Whether this model can take an end frame at all, in any mode. Drives the
 * second slot's presence in the form -- a slot that cannot be sent anywhere is
 * worse than no slot.
 */
export function supportsEndImage(model: VideoModel): boolean {
  return (
    !!model.endpoints.withFirstAndLastImage ||
    !!model.endpoints.withImage?.acceptsEndImage
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

/**
 * Every resolution this model lets you choose between.
 *
 * Empty is the "no control" case, same convention as `aspectRatios`: the form
 * renders nothing and the submit sends the model's fixed `resolution`.
 */
export function resolutionsFor(model: VideoModel): Array<VideoResolution> {
  return model.resolutions ?? []
}

/**
 * Cents per second for this model at this resolution.
 *
 * Falls back to the headline price for a model with no tiers, and for a
 * resolution it does not offer -- which is what a multi-select produces the
 * moment one ticked model has a control and another does not.
 */
export function pricePerSecondFor(
  model: VideoModel,
  resolution?: string,
): number {
  const tier = resolutionsFor(model).find((r) => r.id === resolution)
  return tier?.pricePerSecondCents ?? model.pricePerSecondCents
}

/**
 * The resolution actually sent for this model: the chosen one where the model
 * offers it, its own fixed one otherwise.
 *
 * One place, because the estimate and the submit have to agree -- a price
 * quoted at 480P against a clip rendered at 768P is the bug this prevents.
 */
export function resolutionFor(model: VideoModel, chosen?: string): string {
  const offered = resolutionsFor(model)
  if (chosen && offered.some((r) => r.id === chosen)) return chosen
  return model.resolution
}

/** What a clip of this length will cost, in cents. */
export function estimateCostCents(
  model: VideoModel,
  duration: number,
  resolution?: string,
): number {
  return Math.round(
    pricePerSecondFor(model, resolutionFor(model, resolution)) * duration,
  )
}

export function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
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
  const ids = [textToVideo.id]
  if (withImage) ids.push(withImage.id)
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
