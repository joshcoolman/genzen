export type ModelCategory = 'FLUX' | 'Kling' | 'Specialized' | 'Other'

/**
 * One entry per model. This array is the lineup: in it means offered, out of it
 * means gone. Everything below is derived, so adding a model is one literal.
 *
 * A model is one name over up to two FAL endpoints, picked at submit time by
 * whether the user attached reference images:
 *
 *   textToImage  the endpoint used with no references. null when the model
 *                cannot generate from a prompt alone -- an endpoint that lists
 *                `image_url` as required has no text-to-image mode.
 *   withImages   the endpoint used when references are attached. null when the
 *                model has no image input at all, in which case references are
 *                dropped and the prompt is sent on its own.
 *   maxRefs      how many ADDITIONAL reference images the model accepts,
 *                beyond the source image. Not the endpoint's total image
 *                capacity: z-image's editor takes exactly one image and the
 *                source image is already it, so its maxRefs is 0.
 *
 * Both null is not a model. At least one endpoint must be set.
 *
 * There was a third slot, `textOnlyFallback`, letting a model with no
 * text-to-image endpoint borrow one. FLUX Kontext Dev was its only user, and it
 * went with #304 -- a FLUX.2 entry has a real text-to-image endpoint, so
 * nothing needs to borrow.
 *
 * FAL offers image endpoints for several models carried here as text-only
 * (Kling v3 and Omni 3 have `/image-to-image`, Recraft V3 has
 * `/image-to-image`, FLUX Dev has `/image-to-image`). Wiring one is now filling
 * in `withImages` and `maxRefs` -- see #190.
 */
export interface ModelEntry {
  /** Stable identity. Survives an endpoint moving; never sent to FAL. */
  slug: string
  name: string
  description: string
  category: ModelCategory
  textToImage: string | null
  withImages: string | null
  maxRefs: number
  /**
   * Dollars per image, as a number so the picker can align and sort it (#341).
   * A string ('~$0.03/img') baked presentation into the lineup and made the
   * cheap tier unsortable, which was the only thing that would have surfaced it.
   * Approximate by nature: several models bill per megapixel or per compute
   * second, so this is what a typical image costs, not a quoted rate.
   *
   * **It is a second copy of a number FAL already publishes, and it drifted**
   * (#400): Nano Banana 2 sat at half the real price for as long as anyone had
   * been using it, because the row's estimate reads FAL's pricing API and this
   * column does not. Every entry was checked against that API in the same pass
   * and the rest agreed. When adding or editing one, check it the same way:
   * `GET https://api.fal.ai/v1/models/pricing?endpoint_id=<id>`. Compute-second
   * models are the ones that cannot agree by construction -- see Grok below.
   */
  price?: number
  /**
   * Dollars per image on the **image** endpoint, when it differs.
   *
   * It differs for every megapixel-billed model, by roughly 2x, and the reason
   * is in FAL's unit name: `processed megapixels` counts the images you send as
   * well as the one you get back. So an edit is at minimum two images' worth of
   * pixels, and a model priced per *image* (Nano Banana, Seedream) has no such
   * split and leaves this unset.
   *
   * Measured off FAL's invoices (#304), not derived. Sample sizes are small --
   * one to seven runs per endpoint -- so treat these as good rather than exact,
   * and re-check with `/v1/models/usage` if a figure looks wrong.
   */
  editPrice?: number
  useCase?: string
}

// Endpoint ids verified against https://fal.ai/models
export const IMAGE_MODELS: Array<ModelEntry> = [
  // FLUX Family
  // Kling
  // ByteDance Seedream
  {
    slug: 'seedream-v4',
    name: 'Seedream v4',
    description: 'ByteDance, high-quality realism',
    category: 'Specialized',
    textToImage: 'fal-ai/bytedance/seedream/v4/text-to-image',
    withImages: 'fal-ai/bytedance/seedream/v4/edit',
    // 9, not 10: FAL's schema says "up to 10 image inputs are allowed. If over
    // 10 are sent, only the LAST 10 will be used", and capacity is maxRefs + 1.
    // At 10 we promised eleven slots and FAL would have dropped the first image
    // -- the one that sets orientation. Invisible while the strip capped at the
    // same wrong number; #341 stops it capping.
    maxRefs: 9,
    price: 0.03,
    useCase: 'Cheap, high-quality realism — great daily driver',
  },
  {
    slug: 'seedream-v4-5',
    name: 'Seedream v4.5',
    description: 'ByteDance, multi-image reference',
    category: 'Specialized',
    textToImage: 'fal-ai/bytedance/seedream/v4.5/text-to-image',
    withImages: 'fal-ai/bytedance/seedream/v4.5/edit',
    // See v4 above: ten images total, so nine beyond the first.
    maxRefs: 9,
    price: 0.04,
    useCase: 'Multi-image reference, premium realism',
  },
  // Specialized
  {
    slug: 'nano-banana-2',
    name: 'Nano Banana 2',
    description: 'Reasoning-guided generation',
    category: 'Specialized',
    textToImage: 'fal-ai/nano-banana-2',
    withImages: 'fal-ai/nano-banana-2/edit',
    maxRefs: 3,
    // $0.08, not the $0.04 this said until #400. FAL's pricing API has always
    // said 0.08 and the row's estimate came from there, so the two halves of the
    // app disagreed and the number you read *before* clicking was the wrong one
    // -- on a daily driver, at half the real price.
    price: 0.08,
    useCase: 'Reasoning-guided generation',
  },
  {
    slug: 'flux-2-pro',
    name: 'FLUX.2 Pro',
    description: 'BFL production model, up to 8 images',
    category: 'FLUX',
    textToImage: 'fal-ai/flux-2-pro',
    withImages: 'fal-ai/flux-2-pro/edit',
    // **8 is BFL's number, not FAL's.** The `/edit` schema declares
    // `image_urls` as an unbounded array with no `maxItems`, so nothing here is
    // enforced by the endpoint; this is the figure Black Forest Labs publishes.
    // Capacity is maxRefs + 1.
    maxRefs: 7,
    // **Measured against FAL's own invoices, not extrapolated.** It bills per
    // *processed megapixel* at $0.03, and real runs came in at **1.5 MP for a
    // text-to-image ($0.045) and 2.5 MP for an edit ($0.075)**. Carrying the
    // dearer, because it is what a person should read before clicking -- but
    // note the spread is nearly 2x, so this figure is honest for an edit and
    // pessimistic for a plain generate. One number per model cannot be both.
    //
    // An earlier guess of $0.09, extrapolated from its FLUX.2 siblings, was
    // wrong in both directions: this model's text-to-image run is *smaller*
    // than Flash's, not larger. Sibling megapixel counts do not transfer.
    //
    // It replaced FLUX Kontext Pro at $0.04 an image: **roughly twice the price
    // for eight reference images instead of one**, which was the whole of #304.
    price: 0.045,
    editPrice: 0.075,
    useCase: 'Best FLUX quality — and the one that takes many references',
  },
  // Cheap/fast tier (#262). Three rather than one because the point is
  // comparison: the same prompt across all three costs under two cents.
  {
    slug: 'z-image-turbo',
    name: 'Z-Image Turbo',
    description: 'Tongyi-MAI 6B, sub-cent, ~2s',
    category: 'Other',
    textToImage: 'fal-ai/z-image/turbo',
    // Denoise-from-image with a `strength` dial, NOT instruct editing: told to
    // recolour a mug it returns the same mug, at any strength. It is here so an
    // attached image is used rather than dropped, not as an editor.
    withImages: 'fal-ai/z-image/turbo/image-to-image',
    // One `image_url` slot, and the attached image is it -- same arithmetic as
    // both Kontext entries.
    maxRefs: 0,
    price: 0.005,
    editPrice: 0.007,
    useCase: 'Cheapest fast draft — fire several and skim',
  },
  {
    slug: 'flux-2-flash',
    name: 'FLUX.2 Flash',
    description: 'Cheap reference editing, up to 4 images',
    category: 'FLUX',
    textToImage: 'fal-ai/flux-2/flash',
    withImages: 'fal-ai/flux-2/flash/edit',
    maxRefs: 3,
    // **Measured against FAL's own billing**, not its pricing API, which claims
    // `$0.0008 / compute second` for this endpoint and is wrong: FAL bills it
    // per megapixel like the rest of the cheap tier. A day's real invoices --
    // 5 MP over 2 text-to-image runs, 18 over 6 edits -- put it at 2.5 MP and
    // 3 MP a go, so $0.0125 and $0.015. One number cannot be both, and the
    // dearer one is the safer thing to show before a click.
    price: 0.005,
    editPrice: 0.01,
    useCase: 'Cheap reference editing — preserves the input scene',
  },
  {
    slug: 'flux-2-klein-4b',
    name: 'FLUX.2 Klein 4B',
    description: 'Open-weights fast tier, up to 4 images',
    category: 'FLUX',
    textToImage: 'fal-ai/flux-2/klein/4b',
    withImages: 'fal-ai/flux-2/klein/4b/edit',
    maxRefs: 3,
    price: 0.006,
    editPrice: 0.012,
    useCase: 'Fastest of the cheap tier — re-renders rather than preserves',
  },
  {
    slug: 'grok-imagine-image-2',
    name: 'Grok Imagine 2.0',
    description: 'xAI, text-to-image and instruct editing',
    category: 'Specialized',
    textToImage: 'xai/grok-imagine-image/v2.0/text-to-image',
    withImages: 'xai/grok-imagine-image/v2.0/edit',
    // "A maximum of 3 images are supported" per FAL's schema, and capacity is
    // maxRefs + 1.
    maxRefs: 2,
    // $0.04 (low) / $0.06 (medium) per image at 1k, $0.06 / $0.08 at 2k, plus
    // $0.01 per input image on the edit endpoint. We send neither `quality` nor
    // `resolution`, so this is FAL's defaults: medium at 1k.
    //
    // **It reconciles now, and the mystery was ours** (#400). FAL's pricing API
    // reports `$0.00017 / compute second` here -- and reports the identical
    // figure for LTX-2.5, which is demonstrably billed at $0.01 per unit. It is
    // a placeholder returned when FAL has no real price for an endpoint, not a
    // rate, so there was never a contradiction with xAI's published per-image
    // price. This is that published figure and it stands.
    price: 0.06,
    useCase: 'xAI look — edits up to three images at once',
  },
]

/**
 * The id a model is picked and persisted by. Still an endpoint rather than the
 * slug, because selections live in localStorage and `images.model` rows hold
 * endpoints; migrating that is a later step of #190.
 */
export function pickerId(m: ModelEntry): string {
  return m.textToImage ?? m.withImages!
}

/** Which endpoint a submit should go to. */
export function endpointFor(modelId: string, hasSourceImage: boolean): string {
  const m = findModel(modelId)
  if (!m) return modelId
  if (hasSourceImage && m.withImages) return m.withImages
  return m.textToImage ?? m.withImages ?? modelId
}

/** Additional reference images this model accepts, beyond the source image. */
export function maxRefsFor(modelId: string): number {
  return findModel(modelId)?.maxRefs ?? 0
}

/**
 * How many images the model's endpoint can actually hold (#297).
 *
 * `maxRefs` counts images *beyond the source*, so the real capacity is one
 * more. The panel used to show `maxRefs` as the total and undercounted every
 * model by one -- Nano Banana 2 read `0/3` for an endpoint that takes four.
 * There is no source any more; there is a set, and this is its size.
 *
 * A model with no `withImages` endpoint takes no images at all, so its capacity
 * is zero rather than one. Nothing in `IMAGE_MODELS` is in that state today,
 * which is exactly why it is worth encoding here rather than assuming.
 */
export function imageCapacityFor(modelId: string): number {
  const m = findModel(modelId)
  if (!m?.withImages) return 0
  return m.maxRefs + 1
}

function findModel(modelId: string): ModelEntry | undefined {
  return IMAGE_MODELS.find(
    (m) =>
      m.slug === modelId ||
      m.textToImage === modelId ||
      m.withImages === modelId,
  )
}

/** Every endpoint the app can submit to. Used to warm the FAL pricing cache. */
export const ALL_ENDPOINT_IDS: Array<string> = [
  ...new Set(
    IMAGE_MODELS.flatMap((m) =>
      [m.textToImage, m.withImages].filter((id): id is string => !!id),
    ),
  ),
]

/**
 * Every endpoint genzen has ever submitted to, mapped to a display name.
 * `images.model` stores the *resolved* endpoint, so history rows hold ids like
 * `fal-ai/gpt-image-1.5/edit` and both of a model's endpoints must resolve.
 *
 */
const ENDPOINT_NAMES = new Map<string, string>(
  IMAGE_MODELS.flatMap((m) =>
    [m.textToImage, m.withImages]
      .filter((id): id is string => !!id)
      .map((id) => [id, m.name] as [string, string]),
  ),
)

export function getModelName(modelId: string): string {
  return ENDPOINT_NAMES.get(modelId) ?? RETIRED_MODEL_NAMES[modelId] ?? modelId
}

/**
 * The title a row carries, from the endpoint it was submitted to.
 *
 * Three places need the same answer and used to derive it separately: the
 * reserve, the completion, and the optimistic card the browser draws before
 * either has run (#367). A card whose badge changes at settle is a card that
 * was guessing, so the guess and the truth have to be the same function.
 *
 * The full id is looked up **first**, and `/edit` stripped only as a fallback.
 * The other order looks equivalent and is not: Seedream v4.5 registers its
 * image endpoint *as* `.../v4.5/edit`, so stripping first threw away the only
 * key that names it and every edit through that model was badged with a raw
 * endpoint id. Stripping still earns its place for the models that register
 * without the suffix -- it is a route into a model, not a model.
 */
export function modelTitleFor(falModelId: string): string {
  const direct = getModelName(falModelId)
  if (direct !== falModelId) return direct
  const base = falModelId.replace(/\/edit$/, '')
  return getModelName(base) || base
}

/**
 * Endpoints no model in the lineup claims, mapped to a name anyway.
 *
 * `images` rows outlive the lineup: dropping a model from IMAGE_MODELS does not
 * delete the images it made, and Activity, Canvas and Trash still have to label
 * them. Removing a name here does not break anything, it just makes old rows
 * show a raw endpoint id.
 *
 * Nothing here is selectable and nothing here is submittable. The one mechanism
 * that could submit to a retired endpoint -- FLUX Kontext Dev borrowing
 * `fal-ai/flux/dev` for its text-only case -- went with #304, along with the
 * `textOnlyFallback` slot itself.
 */
export const RETIRED_MODEL_NAMES: Record<string, string | undefined> = {
  // Seedream v4 before FAL split the endpoint into /text-to-image and /edit.
  'fal-ai/bytedance/seedream/v4': 'Seedream v4',

  // Cut from the lineup: no image endpoint wired, so they could not honour
  // "attach an image or not and it works". FAL does offer image endpoints for
  // Kling and Recraft -- re-adding either is one entry with `withImages` set,
  // which is how Grok came back as the versioned v2.0 pair. FLUX Schnell has no
  // image variant at FAL at all.
  //
  // `xai/grok-imagine-image` is the unversioned endpoint rows were written with
  // before that; it keeps the unversioned name so old rows do not claim to be
  // 2.0.
  'fal-ai/flux/schnell': 'FLUX Schnell',
  'fal-ai/flux/dev': 'FLUX Dev',
  // Cut on speed rather than output: both were slow enough through FAL to be
  // not worth the wait. FAL carries faster-looking GPT surfaces we never tried
  // -- `fal-ai/gpt-image-1-mini`, and an `openai/`-namespace passthrough -- and
  // whether either earns a slot back is a research issue, not a guess made
  // here. We also never sent a `quality` param, so the default may be the
  // whole story.
  'fal-ai/gpt-image-1.5': 'GPT Image 1.5',
  'fal-ai/gpt-image-1.5/edit': 'GPT Image 1.5',
  'fal-ai/gpt-image-2': 'GPT Image 2',
  'fal-ai/gpt-image-2/edit': 'GPT Image 2',
  // Cut on its results rather than its wiring. Both ids are here because it
  // had two: rows made with an image carry the Kontext endpoint, and rows made
  // without one carry FLUX Dev above, which it borrowed.
  'fal-ai/flux-kontext/dev': 'FLUX Kontext Dev',
  // Replaced by FLUX.2 Pro in #304, on BFL's own advice: "All FLUX.2 models
  // natively support both text-to-image generation AND image-to-image editing
  // via reference images. There's no need to use legacy FLUX.1 Kontext models
  // for editing tasks." Both endpoints, because a row made with an image
  // carries the editor and a row made without carries the other.
  'fal-ai/flux-pro/kontext': 'FLUX Kontext Pro',
  'fal-ai/flux-pro/kontext/text-to-image': 'FLUX Kontext Pro',
  'fal-ai/kling-image/v3/text-to-image': 'Kling v3',
  'fal-ai/kling-image/o3/text-to-image': 'Kling Omni 3',
  'fal-ai/recraft/v3/text-to-image': 'Recraft V3',
  'xai/grok-imagine-image': 'Grok Imagine',
}

/**
 * What a submit will cost, in cents, and what the figure does not cover (#416).
 *
 * Images had no estimate at all until this — on the one route where a stepper,
 * a prompt list and multi-select models all multiply at once, so the count
 * reaches double figures from a panel showing "1".
 *
 * Priced off **this lineup, not FAL's pricing API**. That API disagrees with
 * what FAL actually bills on half the endpoints checked, and hands back
 * `0.00017 / compute seconds` as a placeholder where it has no price at all
 * (#400). A pre-generation figure is worth having only if it is roughly what
 * you get charged.
 *
 * `unpriced` is the honest half: `price` is optional, and a model without one
 * contributes nothing to `cents`. Reporting that separately is what stops the
 * total quietly under-reporting — genzen's whole cost promise is that its
 * numbers match FAL's, so a partial figure has to say it is partial.
 */
export function estimateImageCostCents(
  modelIds: Array<string>,
  runsPerModel: number,
  hasImages: boolean,
): { cents: number; unpriced: number } {
  let cents = 0
  let unpriced = 0
  for (const id of modelIds) {
    const m = findModel(id)
    // **The endpoint decides the price, and the images decide the endpoint.**
    // `endpointFor` already switches to `withImages` when something is staged,
    // and for every megapixel-billed model that endpoint costs about twice as
    // much -- FAL's `processed megapixels` counts what you send as well as what
    // comes back. Estimating both at one figure meant the number moved when
    // the count changed and never when the *kind* of request did.
    const price = (hasImages ? m?.editPrice : undefined) ?? m?.price
    if (price == null) {
      unpriced += 1
      continue
    }
    cents += price * 100 * runsPerModel
  }
  return { cents, unpriced }
}
