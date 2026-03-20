export type ModelCategory = 'FLUX' | 'Kling' | 'Specialized' | 'Other'

export interface ImageModel {
  id: string
  name: string
  description: string
  category: ModelCategory
  supportsImageInput?: boolean
  imageInputModelId?: string
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
  },
  {
    id: 'fal-ai/flux/schnell',
    name: 'FLUX Schnell',
    description: 'Fast, reliable default',
    category: 'FLUX',
  },
  {
    id: 'fal-ai/flux/dev',
    name: 'FLUX Dev',
    description: 'High-quality 12B model',
    category: 'FLUX',
  },
  {
    id: 'fal-ai/flux-2-pro',
    name: 'FLUX.2 Pro',
    description: 'Best photorealism',
    category: 'FLUX',
    supportsImageInput: true,
    imageInputModelId: 'fal-ai/flux-2-pro/edit',
  },
  // Kling - verified models
  {
    id: 'fal-ai/kling-image/v3/text-to-image',
    name: 'Kling v3',
    description: 'Latest Kling model',
    category: 'Kling',
  },
  {
    id: 'fal-ai/kling-image/o3/text-to-image',
    name: 'Kling Omni 3',
    description: 'Flawless consistency',
    category: 'Kling',
  },

  // ByteDance Seedream - verified models
  {
    id: 'fal-ai/bytedance/seedream/v4/text-to-image',
    name: 'Seedream v4',
    description: 'ByteDance, high-quality realism',
    category: 'Specialized',
    supportsImageInput: true,
    imageInputModelId: 'fal-ai/bytedance/seedream/v4/edit',
  },
  {
    id: 'fal-ai/gpt-image-1.5',
    name: 'GPT Image 1.5',
    description: 'OpenAI, high-quality generation',
    category: 'Specialized',
    supportsImageInput: true,
    imageInputModelId: 'fal-ai/gpt-image-1.5/edit',
  },
  // ByteDance Seedream v4.5
  {
    id: 'fal-ai/bytedance/seedream/v4.5/text-to-image',
    name: 'Seedream v4.5',
    description: 'ByteDance, multi-image reference',
    category: 'Specialized',
    supportsImageInput: true,
    imageInputModelId: 'fal-ai/bytedance/seedream/v4.5/edit',
  },
  // Specialized - verified models
  {
    id: 'fal-ai/nano-banana-2',
    name: 'Nano Banana 2',
    description: 'Google, reasoning-guided generation',
    category: 'Specialized',
    supportsImageInput: true,
    imageInputModelId: 'fal-ai/nano-banana-2/edit',
  },
  {
    id: 'fal-ai/recraft/v3/text-to-image',
    name: 'Recraft V3',
    description: 'SOTA benchmarks, vector art',
    category: 'Specialized',
  },
  {
    id: 'xai/grok-imagine-image',
    name: 'Grok Imagine',
    description: 'xAI, highly aesthetic',
    category: 'Specialized',
  },
]

export const DEFAULT_MODEL = ALL_IMAGE_MODELS[0].id

// Feature-specific model defaults — change here, not in server files
export const STORYBOARD_FRAME_MODEL = ALL_IMAGE_MODELS.find(
  (m) => m.id === 'fal-ai/nano-banana-2',
)!.id

export const CHARACTER_REF_MODEL = ALL_IMAGE_MODELS.find(
  (m) => m.id === 'fal-ai/flux/schnell',
)!.id

export const IMAGE_INPUT_MODELS = ALL_IMAGE_MODELS.filter(
  (m) => m.supportsImageInput,
)

export const REFINE_CAPABLE_MODELS = ALL_IMAGE_MODELS.filter(
  (m) => m.supportsImageInput && m.imageInputModelId,
)

export function getModelName(modelId: string): string {
  return (
    ALL_IMAGE_MODELS.find((m) => m.id === modelId)?.name ??
    EDIT_MODELS.find((m) => m.id === modelId)?.name ??
    modelId
  )
}

export interface EditModel {
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
    id: 'fal-ai/nano-banana-2/edit',
    name: 'Nano Banana 2',
    description: 'Reasoning-guided edits',
    maxRefImages: 14,
  },
  {
    id: 'fal-ai/flux-2-pro/edit',
    name: 'FLUX.2 Pro Edit',
    description: 'Best photorealism edits',
    maxRefImages: 9,
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

export const DEFAULT_EDIT_MODEL = EDIT_MODELS[0].id
