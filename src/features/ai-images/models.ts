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
  {
    id: 'fal-ai/flux-2-flex',
    name: 'FLUX.2 Flex',
    description: 'Flexible generation',
    category: 'FLUX',
    supportsImageInput: true,
    imageInputModelId: 'fal-ai/flux-2-flex/edit',
  },
  {
    id: 'fal-ai/flux-pro/kontext',
    name: 'FLUX Kontext Pro',
    description: 'Subject-consistent generation',
    category: 'FLUX',
    supportsImageInput: true,
  },
  {
    id: 'fal-ai/flux-krea-lora/stream',
    name: 'FLUX LoRA Stream',
    description: 'LoRA-enhanced streaming',
    category: 'FLUX',
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
  // Specialized - verified models
  {
    id: 'fal-ai/nano-banana',
    name: 'Nano Banana',
    description: 'Google, fast + cheap',
    category: 'Specialized',
    supportsImageInput: true,
    imageInputModelId: 'fal-ai/nano-banana/edit',
  },
  {
    id: 'fal-ai/nano-banana-pro',
    name: 'Nano Banana Pro',
    description: 'Google SOTA, realism + typography',
    category: 'Specialized',
    supportsImageInput: true,
    imageInputModelId: 'fal-ai/nano-banana-pro/edit',
  },
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
  {
    id: 'imagineart/imagineart-1.5-preview/text-to-image',
    name: 'ImagineArt 1.5',
    description: 'Professional realism',
    category: 'Specialized',
  },
  {
    id: 'bria/fibo/generate',
    name: 'Bria FIBO',
    description: 'Commercial-safe, licensed data',
    category: 'Specialized',
  },

  // Other - verified models
  {
    id: 'fal-ai/qwen-image-2/pro/text-to-image',
    name: 'Qwen Image 2 Pro',
    description: 'Complex text rendering',
    category: 'Other',
  },
  {
    id: 'fal-ai/stable-diffusion-v35-large',
    name: 'SD 3.5 Large',
    description: 'Stable Diffusion 3.5',
    category: 'Other',
    supportsImageInput: true,
  },
]

// Default visible models - curated selection of most useful models
export const DEFAULT_VISIBLE_MODELS = [
  ALL_IMAGE_MODELS[0], // FLUX Schnell
  ALL_IMAGE_MODELS[1], // FLUX Dev
  ALL_IMAGE_MODELS[2], // FLUX.2 Pro
  ALL_IMAGE_MODELS[3], // FLUX.2 Flex
  ALL_IMAGE_MODELS[4], // FLUX Kontext Pro
  ALL_IMAGE_MODELS[8], // Seedream v4
  ALL_IMAGE_MODELS[9], // Nano Banana
  ALL_IMAGE_MODELS[10], // Nano Banana Pro
  ALL_IMAGE_MODELS[11], // Nano Banana 2
  ALL_IMAGE_MODELS[12], // Recraft V3
  ALL_IMAGE_MODELS[13], // Grok Imagine
  ALL_IMAGE_MODELS[14], // ImagineArt 1.5
]

export const DEFAULT_MODEL = ALL_IMAGE_MODELS[0].id

export const IMAGE_INPUT_MODELS = ALL_IMAGE_MODELS.filter(
  (m) => m.supportsImageInput,
)

export const REFINE_CAPABLE_MODELS = ALL_IMAGE_MODELS.filter(
  (m) => m.supportsImageInput && m.imageInputModelId,
)

/**
 * Get visible models by their IDs
 */
export function getVisibleModels(ids: Array<string>): Array<ImageModel> {
  return ALL_IMAGE_MODELS.filter((model) => ids.includes(model.id))
}

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
    id: 'fal-ai/nano-banana/edit',
    name: 'Nano Banana',
    description: 'Fast + cheap edits',
    maxRefImages: 4,
  },
  {
    id: 'fal-ai/nano-banana-pro/edit',
    name: 'Nano Banana Pro',
    description: 'Realism + typography',
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
    maxRefImages: 8,
  },
  {
    id: 'fal-ai/flux-2-flex/edit',
    name: 'FLUX.2 Flex Edit',
    description: 'Flexible multi-image edits',
    maxRefImages: 4,
  },
  {
    id: 'fal-ai/bytedance/seedream/v4/edit',
    name: 'Seedream v4',
    description: 'ByteDance, high-quality edits',
    maxRefImages: 4,
  },
  {
    id: 'fal-ai/bytedance/seedream/v4.5/edit',
    name: 'Seedream v4.5',
    description: 'Multi-image reference editing',
    maxRefImages: 9,
  },
]

export const DEFAULT_EDIT_MODEL = EDIT_MODELS[0].id
