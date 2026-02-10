export interface ImageModel {
  id: string;
  name: string;
  description: string;
}

export const IMAGE_MODELS: ImageModel[] = [
  {
    id: "fal-ai/flux/schnell",
    name: "FLUX Schnell",
    description: "Fast, reliable default",
  },
  {
    id: "fal-ai/flux-2-turbo",
    name: "FLUX.2 Turbo",
    description: "Fastest, cheapest",
  },
  {
    id: "fal-ai/flux-2-max",
    name: "FLUX.2 Max",
    description: "High quality FLUX",
  },
  {
    id: "fal-ai/nano-banana-pro",
    name: "Nano Banana Pro",
    description: "Google SOTA, realism + typography",
  },
  {
    id: "fal-ai/recraft/v3/text-to-image",
    name: "Recraft V3",
    description: "SOTA benchmarks, vector art",
  },
  {
    id: "xai/grok-imagine-image",
    name: "Grok Imagine",
    description: "xAI, highly aesthetic",
  },
  {
    id: "imagineart/imagineart-1.5-preview/text-to-image",
    name: "ImagineArt 1.5",
    description: "Professional realism",
  },
];

export const DEFAULT_MODEL = IMAGE_MODELS[0].id;
