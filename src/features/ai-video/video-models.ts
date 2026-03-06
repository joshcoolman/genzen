export interface VideoModel {
  id: string
  name: string
  description: string
  supportsFlf: boolean
  supportsI2V: boolean
}

export const ALL_VIDEO_MODELS: Array<VideoModel> = [
  {
    id: 'fal-ai/kling-video/v3/pro/image-to-video',
    name: 'Kling 3.0 Pro',
    description: 'Best quality, cinematic visuals + native audio',
    supportsFlf: true,
    supportsI2V: true,
  },
  {
    id: 'fal-ai/kling-video/o3/standard/image-to-video',
    name: 'Kling O3',
    description: 'First/last frame transitions',
    supportsFlf: true,
    supportsI2V: true,
  },
  {
    id: 'fal-ai/kling-video/v2.6/pro/image-to-video',
    name: 'Kling 2.6 Pro',
    description: 'Cinematic visuals + native audio',
    supportsFlf: true,
    supportsI2V: true,
  },
  {
    id: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
    name: 'Kling 2.5 Turbo',
    description: 'Fast, fluid motion',
    supportsFlf: true,
    supportsI2V: true,
  },
  {
    id: 'fal-ai/kling-video/o1/image-to-video',
    name: 'Kling O1',
    description: 'Original model, proven reliability',
    supportsFlf: true,
    supportsI2V: true,
  },
]

export const DEFAULT_VIDEO_MODEL = ALL_VIDEO_MODELS[0].id

export function getVideoModel(id: string): VideoModel | undefined {
  return ALL_VIDEO_MODELS.find((m) => m.id === id)
}

export function getVideoModelName(id: string): string {
  return getVideoModel(id)?.name ?? id
}
