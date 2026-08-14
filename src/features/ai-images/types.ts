import type { ImageOrigin } from '#/lib/types/db'

export interface SavedAiImage {
  id: string
  /** Which surface made it (#207). The gallery's filter reads this. */
  origin: ImageOrigin
  title: string
  storage_path: string | null
  thumbnail_path?: string | null
  created_at: string
  sort_order?: number | null
  status: 'pending' | 'completed' | 'failed'
  /** On a canvas right now. Derived per read from `canvas_images` (#216), not a
   *  column -- the stored boolean this replaces drifted from the rows that are
   *  the truth. Absent on a card that has not come back from the server yet. */
  on_canvas?: boolean
  deleted_at?: string | null
  /** The one group this image sits in, or null for top level (#319). Cleared
   *  on trash, so a restored image always comes back at top level. */
  group_id?: string | null
  description?: string | null
  generation_error: string | null
  generation_metadata: {
    /** What was sent to the provider. Retry replays this. */
    prompt: string
    model: string
    seed?: number
    elapsed?: number
    generation_type?: string
    /** What the user typed before the enhancer rewrote it (#210). */
    original_prompt?: string
    /** The textarea contents at submit, when `prompt` is not that -- canvas
     *  prepends `[Image 1, ...]` labels. Absent when the two are identical. */
    typed_prompt?: string
    /** `prompt` was written by the describer, not the user. */
    prompt_derived_from_source?: boolean
    source_image_id?: string
    /** Identity of a pasted/dropped source, which has no library row (#210). */
    source_image_sha256?: string
    source_image_bytes?: number
    root_image_id?: string
    aspect_ratio?: string
    reference_image_ids?: Array<string>
    /** Written only when the endpoint held fewer images than it was given
     *  (#341). Absent on a generation that used everything it was offered,
     *  which is what makes their presence the whole condition for the note. */
    images_requested?: number
    images_used?: number
  } | null
}
