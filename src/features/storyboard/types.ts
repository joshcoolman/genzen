export interface Scene {
  id: string
  scene_number: number
  duration_seconds: number
  visual_description: string
  action: string
  emotion: string
  framing: string
  camera: string
  caption: string
  characters: Array<string>
  image_id: string | null
  image_url: string | null
}

export interface StoryboardCharacter {
  slug: string
  name: string
  description: string
  reference_images: Array<{
    id: string
    url: string | null
  }>
}

export interface Storyboard {
  id: string
  user_id: string
  title: string
  story_prompt: string
  refined_story: string | null
  scenes: Array<Scene>
  characters: Array<StoryboardCharacter>
  status: 'draft' | 'scenes_generated' | 'generating_frames' | 'complete'
  created_at: string
  updated_at: string
}

export type StoryboardStatus = Storyboard['status']

export const FRAME_MODELS = [
  { id: 'fal-ai/nanobanana/v2', name: 'Nanobanana 2' },
  { id: 'fal-ai/flux/schnell', name: 'FLUX Schnell' },
  { id: 'fal-ai/flux/dev', name: 'FLUX Dev' },
] as const
