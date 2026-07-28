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
 *   maxRefs      how many references that endpoint actually takes. Submit sends
 *                min(attached, maxRefs). 0 is not a special case, it is just
 *                the smallest number -- it is what "text only" means.
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
  maxRefs: number
  locked?: boolean
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
    maxRefs: 1,
    displayPrice: '~$0.03/img',
    useCase: 'Cheap img2img — fast iteration with a reference',
  },
  {
    slug: 'flux-schnell',
    name: 'FLUX Schnell',
    description: 'Fast, reliable default',
    category: 'FLUX',
    textToImage: 'fal-ai/flux/schnell',
    withImages: null,
    maxRefs: 0,
    displayPrice: '~$0.003/img',
    useCase: 'Cheapest, fastest — exploration mode, run dozens',
  },
  {
    slug: 'flux-dev',
    name: 'FLUX Dev',
    description: 'High-quality 12B model',
    category: 'FLUX',
    textToImage: 'fal-ai/flux/dev',
    withImages: null,
    maxRefs: 0,
    displayPrice: '~$0.05/img',
    useCase: 'Quality 12B model — go-to for finished work',
  },
  // Kling
  {
    slug: 'kling-v3',
    name: 'Kling v3',
    description: 'Latest Kling model',
    category: 'Kling',
    textToImage: 'fal-ai/kling-image/v3/text-to-image',
    withImages: null,
    maxRefs: 0,
    displayPrice: '~$0.05/img',
    useCase: 'Latest Kling — solid all-rounder',
  },
  {
    slug: 'kling-omni-3',
    name: 'Kling Omni 3',
    description: 'Flawless consistency',
    category: 'Kling',
    textToImage: 'fal-ai/kling-image/o3/text-to-image',
    withImages: null,
    maxRefs: 0,
    displayPrice: '~$0.05/img',
    useCase: 'Premium Kling — flawless consistency',
  },
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
    locked: true,
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
    maxRefs: 1,
    displayPrice: '~$0.04/img',
    useCase: 'Pro img2img — solid for refinement work',
  },
  {
    slug: 'recraft-v3',
    name: 'Recraft V3',
    description: 'SOTA benchmarks, vector art',
    category: 'Specialized',
    textToImage: 'fal-ai/recraft/v3/text-to-image',
    withImages: null,
    maxRefs: 0,
    displayPrice: '~$0.04/img',
    useCase: 'Vector art and clean illustration',
  },
  {
    slug: 'grok-imagine',
    name: 'Grok Imagine',
    description: 'xAI, highly aesthetic',
    category: 'Specialized',
    textToImage: 'xai/grok-imagine-image',
    withImages: null,
    maxRefs: 0,
    displayPrice: '~$0.04/img',
    useCase: 'xAI — highly aesthetic style',
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
export function endpointFor(
  modelId: string,
  hasReferenceImages: boolean,
): string {
  const m = findModel(modelId)
  if (!m) return modelId
  if (hasReferenceImages && m.withImages) return m.withImages
  return m.textToImage ?? m.withImages ?? modelId
}

/** How many reference images this model actually accepts. */
export function maxRefsFor(modelId: string): number {
  return findModel(modelId)?.maxRefs ?? 0
}

function findModel(modelId: string): ModelEntry | undefined {
  return IMAGE_MODELS.find(
    (m) =>
      m.slug === modelId ||
      m.textToImage === modelId ||
      m.withImages === modelId,
  )
}

// ---------------------------------------------------------------------------
// Legacy shape, derived. Consumers move off these over steps 3 and 4 of #190.
// ---------------------------------------------------------------------------

export interface ImageModel {
  id: string
  name: string
  description: string
  category: ModelCategory
  supportsImageInput?: boolean
  imageInputModelId?: string
  locked?: boolean
  displayPrice?: string
  useCase?: string
}

export const ALL_IMAGE_MODELS: Array<ImageModel> = IMAGE_MODELS.map((m) => ({
  id: pickerId(m),
  name: m.name,
  description: m.description,
  category: m.category,
  ...(m.withImages ? { supportsImageInput: true } : {}),
  // Only a model with both endpoints has one to *switch to*; Kontext Dev's
  // single endpoint is already the picker id, which is why it never had this.
  ...(m.textToImage && m.withImages ? { imageInputModelId: m.withImages } : {}),
  ...(m.locked ? { locked: true } : {}),
  ...(m.displayPrice ? { displayPrice: m.displayPrice } : {}),
  ...(m.useCase ? { useCase: m.useCase } : {}),
}))

export const KONTEXT_DEV_ID = 'fal-ai/flux-kontext/dev'
export const KONTEXT_DEV_FALLBACK_ID = 'fal-ai/flux/dev'

export const IMAGE_INPUT_MODELS = ALL_IMAGE_MODELS.filter(
  (m) => m.supportsImageInput,
)

/**
 * Every endpoint genzen has ever submitted to, mapped to a display name.
 * `images.model` stores the *resolved* endpoint, so history rows hold ids like
 * `fal-ai/gpt-image-1.5/edit` and both of a model's endpoints must resolve.
 */
const ENDPOINT_NAMES = new Map<string, string>(
  IMAGE_MODELS.flatMap((m) =>
    [m.textToImage, m.withImages]
      .filter((id): id is string => !!id)
      .map((id) => [id, m.name] as [string, string]),
  ),
)

export function getModelName(modelId: string): string {
  return ENDPOINT_NAMES.get(modelId) ?? modelId
}

interface EditModel {
  id: string
  name: string
  description: string
  maxRefImages: number
}

export const EDIT_MODELS: Array<EditModel> = [
  {
    id: 'fal-ai/gpt-image-1.5/edit',
    name: 'GPT Image 1.5',
    description: 'OpenAI, high-quality edits',
    maxRefImages: 4,
  },
  {
    id: 'fal-ai/gpt-image-2/edit',
    name: 'GPT Image 2',
    description: 'OpenAI, latest image edits with inpainting',
    maxRefImages: 4,
  },
  {
    id: 'fal-ai/nano-banana-2/edit',
    name: 'Nano Banana 2',
    description: 'Reasoning-guided edits',
    maxRefImages: 3,
  },
  {
    id: 'fal-ai/bytedance/seedream/v4/edit',
    name: 'Seedream v4',
    description: 'ByteDance, high-quality edits',
    maxRefImages: 10,
  },
  {
    id: 'fal-ai/bytedance/seedream/v4.5/edit',
    name: 'Seedream v4.5',
    description: 'Multi-image reference editing',
    maxRefImages: 10,
  },
]
