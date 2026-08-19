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
    /** What the user would call their prompt -- the textarea contents, or the
     *  describer's text when they generated from a picture and typed nothing.
     *  This is what every caption, lightbox and variation seed shows. Since
     *  #367 it is *not* what was sent; see `sent_prompt`. */
    prompt: string
    /** What the provider received: `prompt` plus system instructions (#272),
     *  any canvas image labels, and refine wrapping. Written only when it
     *  differs, and absent on rows predating the split -- where `prompt` was
     *  the sent string, which is why Retry reads `sent_prompt ?? prompt`. */
    sent_prompt?: string
    model: string
    seed?: number
    elapsed?: number
    generation_type?: string
    /** Pre-#367 rows only: the textarea contents back when `prompt` held the
     *  sent string. The two swapped roles, so nothing writes this any more. */
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
    /** What the generation cost, written once at completion (#400). Activity's
     *  figure; read here so a lab run can price itself per result. */
    provider_cost_cents?: number
    provider_cost_is_estimate?: boolean
  } | null
}
