export type ModelCategory = 'FLUX' | 'Kling' | 'Specialized' | 'Other'

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

// ALL model IDs verified against https://fal.ai/models?category=text-to-image
export const ALL_IMAGE_MODELS: Array<ImageModel> = [
  // FLUX Family - verified models only
  {
    id: 'fal-ai/flux-kontext/dev',
    name: 'FLUX Kontext Dev',
    description: 'Fast img2img + text steering',
    category: 'FLUX',
    supportsImageInput: true,
    displayPrice: '~$0.03/img',
    useCase: 'Cheap img2img — fast iteration with a reference',
  },
  {
    id: 'fal-ai/flux/schnell',
    name: 'FLUX Schnell',
    description: 'Fast, reliable default',
    category: 'FLUX',
    displayPrice: '~$0.003/img',
    useCase: 'Cheapest, fastest — exploration mode, run dozens',
  },
  {
    id: 'fal-ai/flux/dev',
    name: 'FLUX Dev',
    description: 'High-quality 12B model',
    category: 'FLUX',
    displayPrice: '~$0.05/img',
    useCase: 'Quality 12B model — go-to for finished work',
  },
  // Kling - verified models
  {
    id: 'fal-ai/kling-image/v3/text-to-image',
    name: 'Kling v3',
    description: 'Latest Kling model',
    category: 'Kling',
    displayPrice: '~$0.05/img',
    useCase: 'Latest Kling — solid all-rounder',
  },
  {
    id: 'fal-ai/kling-image/o3/text-to-image',
    name: 'Kling Omni 3',
    description: 'Flawless consistency',
    category: 'Kling',
    displayPrice: '~$0.05/img',
    useCase: 'Premium Kling — flawless consistency',
  },

  // ByteDance Seedream - verified models
  {
    id: 'fal-ai/bytedance/seedream/v4/text-to-image',
    name: 'Seedream v4',
    description: 'ByteDance, high-quality realism',
    category: 'Specialized',
    supportsImageInput: true,
    imageInputModelId: 'fal-ai/bytedance/seedream/v4/edit',
    displayPrice: '~$0.03/img',
    useCase: 'Cheap, high-quality realism — great daily driver',
  },
  {
    id: 'fal-ai/gpt-image-1.5',
    name: 'GPT Image 1.5',
    description: 'OpenAI, high-quality generation',
    category: 'Specialized',
    supportsImageInput: true,
    imageInputModelId: 'fal-ai/gpt-image-1.5/edit',
    displayPrice: '~$0.04/img',
    useCase: 'OpenAI quality — works with references',
  },
  {
    id: 'fal-ai/gpt-image-2',
    name: 'GPT Image 2',
    description: 'OpenAI, quality tiers + inpainting',
    category: 'Specialized',
    supportsImageInput: true,
    imageInputModelId: 'fal-ai/gpt-image-2/edit',
    displayPrice: '~$1.00/img',
    useCase: 'Premium OpenAI — use when you know what you want',
  },
  // ByteDance Seedream v4.5
  {
    id: 'fal-ai/bytedance/seedream/v4.5/text-to-image',
    name: 'Seedream v4.5',
    description: 'ByteDance, multi-image reference',
    category: 'Specialized',
    supportsImageInput: true,
    imageInputModelId: 'fal-ai/bytedance/seedream/v4.5/edit',
    displayPrice: '~$0.04/img',
    useCase: 'Multi-image reference, premium realism',
  },
  // Specialized - verified models
  {
    id: 'fal-ai/nano-banana-2',
    name: 'Nano Banana 2',
    description: 'Reasoning-guided generation',
    category: 'Specialized',
    supportsImageInput: true,
    imageInputModelId: 'fal-ai/nano-banana-2/edit',
    locked: true,
    displayPrice: '~$0.04/img',
    useCase: 'Reasoning-guided generation',
  },
  {
    id: 'fal-ai/flux-pro/kontext/text-to-image',
    name: 'FLUX Kontext Pro',
    description: 'Pro img2img + text steering',
    category: 'FLUX',
    supportsImageInput: true,
    // Base id is the text-only endpoint; with a source/reference image we switch
    // to the single-image Kontext editor (which exposes `image_url`). Without
    // this the source image was silently dropped and it generated from the
    // prompt alone.
    imageInputModelId: 'fal-ai/flux-pro/kontext',
    displayPrice: '~$0.04/img',
    useCase: 'Pro img2img — solid for refinement work',
  },
  {
    id: 'fal-ai/recraft/v3/text-to-image',
    name: 'Recraft V3',
    description: 'SOTA benchmarks, vector art',
    category: 'Specialized',
    displayPrice: '~$0.04/img',
    useCase: 'Vector art and clean illustration',
  },
  {
    id: 'xai/grok-imagine-image',
    name: 'Grok Imagine',
    description: 'xAI, highly aesthetic',
    category: 'Specialized',
    displayPrice: '~$0.04/img',
    useCase: 'xAI — highly aesthetic style',
  },
]

export const KONTEXT_DEV_ID = ALL_IMAGE_MODELS.find(
  (m) => m.id === 'fal-ai/flux-kontext/dev',
)!.id

export const KONTEXT_DEV_FALLBACK_ID = ALL_IMAGE_MODELS.find(
  (m) => m.id === 'fal-ai/flux/dev',
)!.id

export const IMAGE_INPUT_MODELS = ALL_IMAGE_MODELS.filter(
  (m) => m.supportsImageInput,
)

// Resolved image-input endpoints that aren't first-class registry/EDIT_MODELS
// entries but should still render a friendly name (e.g. FLUX Kontext Pro's
// single-image img2img endpoint, which we submit to but don't list separately).
const ENDPOINT_NAME_ALIASES = new Map<string, string>([
  ['fal-ai/flux-pro/kontext', 'FLUX Kontext Pro'],
])

export function getModelName(modelId: string): string {
  return (
    ALL_IMAGE_MODELS.find((m) => m.id === modelId)?.name ??
    EDIT_MODELS.find((m) => m.id === modelId)?.name ??
    ENDPOINT_NAME_ALIASES.get(modelId) ??
    modelId
  )
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
