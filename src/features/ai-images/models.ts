export type ModelCategory = "FLUX" | "Kling" | "Specialized" | "Other";

export interface ImageModel {
  id: string;
  name: string;
  description: string;
  category: ModelCategory;
}

// ALL model IDs verified against https://fal.ai/models?category=text-to-image
export const ALL_IMAGE_MODELS: ImageModel[] = [
  // FLUX Family - verified models only
  {
    id: "fal-ai/flux/schnell",
    name: "FLUX Schnell",
    description: "Fast, reliable default",
    category: "FLUX",
  },
  {
    id: "fal-ai/flux/dev",
    name: "FLUX Dev",
    description: "High-quality 12B model",
    category: "FLUX",
  },
  {
    id: "fal-ai/flux-2-flex",
    name: "FLUX.2 Flex",
    description: "Flexible generation",
    category: "FLUX",
  },
  {
    id: "fal-ai/flux-pro/kontext",
    name: "FLUX Kontext Pro",
    description: "Context-aware generation",
    category: "FLUX",
  },
  {
    id: "fal-ai/flux-krea-lora/stream",
    name: "FLUX LoRA Stream",
    description: "LoRA-enhanced streaming",
    category: "FLUX",
  },

  // Kling - verified models
  {
    id: "fal-ai/kling-image/v3/text-to-image",
    name: "Kling v3",
    description: "Latest Kling model",
    category: "Kling",
  },
  {
    id: "fal-ai/kling-image/o3/text-to-image",
    name: "Kling Omni 3",
    description: "Flawless consistency",
    category: "Kling",
  },

  // Specialized - verified models
  {
    id: "fal-ai/nano-banana-pro",
    name: "Nano Banana Pro",
    description: "Google SOTA, realism + typography",
    category: "Specialized",
  },
  {
    id: "fal-ai/recraft/v3/text-to-image",
    name: "Recraft V3",
    description: "SOTA benchmarks, vector art",
    category: "Specialized",
  },
  {
    id: "xai/grok-imagine-image",
    name: "Grok Imagine",
    description: "xAI, highly aesthetic",
    category: "Specialized",
  },
  {
    id: "imagineart/imagineart-1.5-preview/text-to-image",
    name: "ImagineArt 1.5",
    description: "Professional realism",
    category: "Specialized",
  },
  {
    id: "bria/fibo/generate",
    name: "Bria FIBO",
    description: "Commercial-safe, licensed data",
    category: "Specialized",
  },

  // Other - verified models
  {
    id: "fal-ai/qwen-image",
    name: "Qwen Image",
    description: "Complex text rendering",
    category: "Other",
  },
  {
    id: "fal-ai/stable-diffusion-v35-large",
    name: "SD 3.5 Large",
    description: "Stable Diffusion 3.5",
    category: "Other",
  },
];

// Default visible models - curated selection of 7 most useful models
export const DEFAULT_VISIBLE_MODELS = [
  ALL_IMAGE_MODELS[0], // FLUX Schnell
  ALL_IMAGE_MODELS[1], // FLUX Dev
  ALL_IMAGE_MODELS[2], // FLUX.2 Flex
  ALL_IMAGE_MODELS[7], // Nano Banana Pro
  ALL_IMAGE_MODELS[8], // Recraft V3
  ALL_IMAGE_MODELS[9], // Grok Imagine
  ALL_IMAGE_MODELS[10], // ImagineArt 1.5
];

export const DEFAULT_MODEL = ALL_IMAGE_MODELS[0].id;

/**
 * Get visible models by their IDs
 */
export function getVisibleModels(ids: string[]): ImageModel[] {
  return ALL_IMAGE_MODELS.filter((model) => ids.includes(model.id));
}
