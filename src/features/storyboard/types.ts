export interface GeneratedFrame {
  id: string
  url: string | null
}

export interface Scene {
  id: string
  scene_number: number
  duration_seconds: number
  visual_description: string
  action: string
  emotion: string
  framing: string
  camera: string
  lighting: string
  lens: string
  angle: string
  caption: string
  characters: Array<string>
  generation_notes: string
  reference_images: Array<{ id: string; url: string | null }>
  image_id: string | null
  image_url: string | null
  generated_frames: Array<GeneratedFrame>
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
  video_record_id: string | null
  status:
    | 'draft'
    | 'scenes_generated'
    | 'generating_frames'
    | 'generating_video'
    | 'complete'
  created_at: string
  updated_at: string
}

export type StoryboardStatus = Storyboard['status']
