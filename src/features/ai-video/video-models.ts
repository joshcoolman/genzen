export interface VideoModel {
  id: string
  name: string
  description: string
  supportsFlf: boolean
  supportsI2V: boolean
  durations: Array<string>
  supportsCfgScale: boolean
  supportsNegativePrompt: boolean
  locked?: boolean
}

export const ALL_VIDEO_MODELS: Array<VideoModel> = [
  {
    id: 'fal-ai/kling-video/v3/pro/image-to-video',
    name: 'Kling 3.0 Pro',
    description: 'Best quality, cinematic visuals + native audio',
    supportsFlf: true,
    supportsI2V: true,
    durations: ['5', '10'],
    supportsCfgScale: true,
    supportsNegativePrompt: true,
    locked: true,
  },
  {
    id: 'fal-ai/kling-video/o3/standard/image-to-video',
    name: 'Kling O3',
    description: 'First/last frame transitions',
    supportsFlf: true,
    supportsI2V: true,
    durations: ['5', '10'],
    supportsCfgScale: true,
    supportsNegativePrompt: true,
  },
  {
    id: 'fal-ai/kling-video/v2.6/pro/image-to-video',
    name: 'Kling 2.6 Pro',
    description: 'Cinematic visuals + native audio',
    supportsFlf: true,
    supportsI2V: true,
    durations: ['5', '10'],
    supportsCfgScale: true,
    supportsNegativePrompt: true,
  },
  {
    id: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
    name: 'Kling 2.5 Turbo',
    description: 'Fast, fluid motion',
    supportsFlf: true,
    supportsI2V: true,
    durations: ['5', '10'],
    supportsCfgScale: true,
    supportsNegativePrompt: true,
  },
  {
    id: 'fal-ai/kling-video/o1/image-to-video',
    name: 'Kling O1',
    description: 'Original model, proven reliability',
    supportsFlf: true,
    supportsI2V: true,
    durations: ['5', '10'],
    supportsCfgScale: true,
    supportsNegativePrompt: true,
  },
  {
    id: 'fal-ai/ltx-2.3/image-to-video',
    name: 'LTX-2.3 Pro',
    description: 'Fast, high-quality image-to-video',
    supportsFlf: true,
    supportsI2V: true,
    durations: ['6', '8', '10'],
    supportsCfgScale: false,
    supportsNegativePrompt: false,
  },
  {
    id: 'fal-ai/sora-2/image-to-video',
    name: 'Sora 2',
    description: 'OpenAI video generation from images',
    supportsFlf: false,
    supportsI2V: true,
    durations: ['4', '8', '12'],
    supportsCfgScale: false,
    supportsNegativePrompt: false,
  },
  {
    id: 'fal-ai/wan-25-preview/image-to-video',
    name: 'WAN 2.5',
    description: 'Preview model with natural motion',
    supportsFlf: false,
    supportsI2V: true,
    durations: ['5', '10'],
    supportsCfgScale: false,
    supportsNegativePrompt: true,
  },
]

export const DEFAULT_VIDEO_MODEL = ALL_VIDEO_MODELS[0].id

export function getVideoModel(id: string): VideoModel | undefined {
  return ALL_VIDEO_MODELS.find((m) => m.id === id)
}

export function getVideoModelName(id: string): string {
  return getVideoModel(id)?.name ?? id
}
