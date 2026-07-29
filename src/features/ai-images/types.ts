export interface SavedAiImage {
  id: string
  title: string
  storage_path: string | null
  thumbnail_path?: string | null
  created_at: string
  sort_order?: number | null
  status: 'pending' | 'completed' | 'failed'
  deleted_at?: string | null
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
  } | null
}
