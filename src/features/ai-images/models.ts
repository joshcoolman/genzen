export type ModelCategory = 'FLUX' | 'Kling' | 'Specialized' | 'Other'

/**
 * One entry per model. This array is the lineup: in it means offered, out of it
 * means gone. Everything below is derived, so adding a model is one literal.
 *
 * A model is one name over up to two FAL endpoints, picked at submit time by
 * whether the user attached reference images:
 *
 *   textToImage  the endpoint used with no references. null when the model
 *                cannot generate from a prompt alone -- FLUX Kontext Dev lists
 *                `image_url` as required, so it has no text-to-image mode.
 *   withImages   the endpoint used when references are attached. null when the
 *                model has no image input at all, in which case references are
 *                dropped and the prompt is sent on its own.
 *   maxRefs      how many ADDITIONAL reference images the model accepts,
 *                beyond the source image. Not the endpoint's total image
 *                capacity: both Kontext endpoints take exactly one image, and
 *                the source image is already it, so their maxRefs is 0.
 *
 * A model with no text-to-image endpoint of its own may borrow one via
 * `textOnlyFallback` -- the user picks one name and gets whichever endpoint
 * fits. The borrowed endpoint stays out of the name index, so history rows
 * label it as the model that actually ran.
 *
 * Both null is not a model. At least one endpoint must be set.
 *
 * FAL offers image endpoints for several models carried here as text-only
 * (Kling v3 and Omni 3 have `/image-to-image`, Recraft V3 has
 * `/image-to-image`, Grok Imagine has an `/edit` that requires only `prompt`,
 * FLUX Dev has `/image-to-image`). Wiring one is now filling in `withImages`
 * and `maxRefs` -- see #190.
 */
export interface ModelEntry {
  /** Stable identity. Survives an endpoint moving; never sent to FAL. */
  slug: string
  name: string
  description: string
  category: ModelCategory
  textToImage: string | null
  withImages: string | null
  /** Borrowed endpoint for the no-image case. Only for `textToImage: null`. */
  textOnlyFallback?: string
  maxRefs: number
  displayPrice?: string
  useCase?: string
}

// Endpoint ids verified against https://fal.ai/models
export const IMAGE_MODELS: Array<ModelEntry> = [
  // FLUX Family
  {
    slug: 'flux-kontext-dev',
    name: 'FLUX Kontext Dev',
    description: 'Fast img2img + text steering',
    category: 'FLUX',
    textToImage: null,
    withImages: 'fal-ai/flux-kontext/dev',
    // FAL lists `image_url` as required, so there is no text-to-image mode:
    // with no image we run FLUX Dev, which is what the row is then labelled.
    textOnlyFallback: 'fal-ai/flux/dev',
    // The single `image_url` slot is the source image's.
    maxRefs: 0,
    displayPrice: '~$0.03/img',
    useCase: 'Cheap img2img — fast iteration with a reference',
  },
  // Kling
  // ByteDance Seedream
  {
    slug: 'seedream-v4',
    name: 'Seedream v4',
    description: 'ByteDance, high-quality realism',
    category: 'Specialized',
    textToImage: 'fal-ai/bytedance/seedream/v4/text-to-image',
    withImages: 'fal-ai/bytedance/seedream/v4/edit',
    maxRefs: 10,
    displayPrice: '~$0.03/img',
    useCase: 'Cheap, high-quality realism — great daily driver',
  },
  {
    slug: 'gpt-image-1-5',
    name: 'GPT Image 1.5',
    description: 'OpenAI, high-quality generation',
    category: 'Specialized',
    textToImage: 'fal-ai/gpt-image-1.5',
    withImages: 'fal-ai/gpt-image-1.5/edit',
    maxRefs: 4,
    displayPrice: '~$0.04/img',
    useCase: 'OpenAI quality — works with references',
  },
  {
    slug: 'gpt-image-2',
    name: 'GPT Image 2',
    description: 'OpenAI, quality tiers + inpainting',
    category: 'Specialized',
    textToImage: 'fal-ai/gpt-image-2',
    withImages: 'fal-ai/gpt-image-2/edit',
    maxRefs: 4,
    displayPrice: '~$1.00/img',
    useCase: 'Premium OpenAI — use when you know what you want',
  },
  {
    slug: 'seedream-v4-5',
    name: 'Seedream v4.5',
    description: 'ByteDance, multi-image reference',
    category: 'Specialized',
    textToImage: 'fal-ai/bytedance/seedream/v4.5/text-to-image',
    withImages: 'fal-ai/bytedance/seedream/v4.5/edit',
    maxRefs: 10,
    displayPrice: '~$0.04/img',
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
    displayPrice: '~$0.04/img',
    useCase: 'Reasoning-guided generation',
  },
  {
    slug: 'flux-kontext-pro',
    name: 'FLUX Kontext Pro',
    description: 'Pro img2img + text steering',
    category: 'FLUX',
    textToImage: 'fal-ai/flux-pro/kontext/text-to-image',
    // The single-image Kontext editor. Without switching to it the source
    // image was silently dropped and it generated from the prompt alone.
    withImages: 'fal-ai/flux-pro/kontext',
    // Single-image endpoint; the source image occupies its one slot.
    maxRefs: 0,
    displayPrice: '~$0.04/img',
    useCase: 'Pro img2img — solid for refinement work',
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
  return m.textToImage ?? m.textOnlyFallback ?? m.withImages ?? modelId
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
      [m.textToImage, m.withImages, m.textOnlyFallback].filter(
        (id): id is string => !!id,
      ),
    ),
  ),
]

/**
 * Every endpoint genzen has ever submitted to, mapped to a display name.
 * `images.model` stores the *resolved* endpoint, so history rows hold ids like
 * `fal-ai/gpt-image-1.5/edit` and both of a model's endpoints must resolve.
 *
 * A `textOnlyFallback` is deliberately absent: it belongs to the model that
 * owns it, and a row made through the borrow really was made by that model.
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
 * Endpoints no model in the lineup claims, mapped to a name anyway.
 *
 * `images` rows outlive the lineup: dropping a model from IMAGE_MODELS does not
 * delete the images it made, and Activity, Canvas and Trash still have to label
 * them. Removing a name here does not break anything, it just makes old rows
 * show a raw endpoint id.
 *
 * Nothing here is selectable. Most of it is not submittable either -- the
 * exception is `fal-ai/flux/dev`, which is live as FLUX Kontext Dev's
 * `textOnlyFallback`. It is a routing target, not a model the user picks, which
 * is exactly why it needs a name without an entry.
 */
export const RETIRED_MODEL_NAMES: Record<string, string | undefined> = {
  // Seedream v4 before FAL split the endpoint into /text-to-image and /edit.
  'fal-ai/bytedance/seedream/v4': 'Seedream v4',

  // Cut from the lineup: no image endpoint wired, so they could not honour
  // "attach an image or not and it works". FAL does offer image endpoints for
  // Kling, Recraft and Grok -- re-adding any of them is one entry with
  // `withImages` set. FLUX Schnell has no image variant at FAL at all.
  'fal-ai/flux/schnell': 'FLUX Schnell',
  'fal-ai/flux/dev': 'FLUX Dev',
  'fal-ai/kling-image/v3/text-to-image': 'Kling v3',
  'fal-ai/kling-image/o3/text-to-image': 'Kling Omni 3',
  'fal-ai/recraft/v3/text-to-image': 'Recraft V3',
  'xai/grok-imagine-image': 'Grok Imagine',
}
