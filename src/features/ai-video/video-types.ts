// Unified video types for the new gallery + edit architecture (Phase 5).
// Distinct from the old ai-video/types.ts which is FLF-specific.

export type VideoMethod = 'flf' | 'multishot'

export interface VideoShot {
  id: string
  prompt: string
  duration: number
}

export interface VideoElement {
  id: string
  frontalImageUrl: string
  label: string
}

export interface FlfSnapshot {
  method: 'flf'
  model?: string
  prompt?: string
  transition_prompt?: string | null
  first_frame_id?: string
  first_frame_url?: string | null
  last_frame_id?: string | null
  last_frame_url?: string | null
  duration?: string
  cfg_scale?: number | null
  negative_prompt?: string | null
}

export interface MultishotSnapshot {
  method: 'multishot'
  model?: string
  shots: Array<VideoShot>
  elements: Array<VideoElement>
  start_image_url: string
  aspect_ratio: '16:9' | '9:16' | '1:1'
  shot_type: 'customize' | 'intelligent'
  generate_audio: boolean
  shot_count?: number
  total_duration?: number
}

/**
 * The shape of generation_metadata on a video user_images row.
 * `method` is the canonical discriminator. Old multishot rows use `type: 'multishot'`.
 */
export type VideoGenerationMetadata = {
  parent_id?: string | null
  fal_url?: string
  thumbnail_url?: string
  submitted_at?: string
  error?: string
} & (Partial<FlfSnapshot> | Partial<MultishotSnapshot>) & {
    // backward-compat
    type?: 'multishot'
  }

export interface SavedAiVideo {
  id: string
  title: string
  storage_path: string | null
  /**
   * Path in R2 to the extracted middle-frame poster. Populated by
   * extract-video-thumbnail.server.ts after a video completes. Falls back
   * to the source start/first frame URL in generation_metadata if null.
   */
  thumbnail_path: string | null
  created_at: string
  sort_order?: number | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  deleted_at?: string | null
  generation_error: string | null
  generation_metadata: VideoGenerationMetadata | null
}

/** Infer the method from a video row, defaulting to flf when unambiguous. */
export function getVideoMethod(video: SavedAiVideo): VideoMethod {
  const meta = video.generation_metadata
  if (meta?.method === 'multishot' || meta?.type === 'multishot') {
    return 'multishot'
  }
  return 'flf'
}
