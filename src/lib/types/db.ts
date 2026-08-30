// Row shapes for the tables in `migrations/0001_init.sql`.
//
// Replaces the generated `src/lib/types/supabase.ts` (#176). Hand-written
// because the generator was a Supabase tool and only ever one table's `Row`
// was used -- the `Insert`/`Update`/`Relationships` variants had no reader.
//
// These describe what the app *receives*, which is not quite what the column
// types say: `timestamptz` is an ISO string here and `bigint`/`numeric` are
// numbers, because the queries cast them (see the note in `db.server.ts`).
// `user-image-columns.server.ts` is the select list that produces exactly this
// shape -- the two are a pair, and `db.server.test.ts` fails if they drift.

/**
 * Which surface an image was made on (#207) -- `user_images.origin`, and the
 * `check` constraint in `migrations/0003_origin.sql` is the same three values.
 *
 * Not provenance (what it descends from) and not membership (where it sits):
 * a canvas generation from an uploaded photo descends from an upload, may sit
 * on a canvas, and its origin is `canvas`. Recorded only where the surface
 * *authored* the thing, which is why a paste is `upload` wherever it happened.
 *
 * Lives here rather than beside the insert so client code can name it without
 * importing a `.server` module.
 */
export type ImageOrigin = 'upload' | 'images' | 'canvas'

/** The origins a *generation* can have: an upload is never generated. */
export type GenerationOrigin = Exclude<ImageOrigin, 'upload'>

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Array<Json>

// A `type` rather than an `interface`, deliberately: only a type alias gets an
// implicit index signature, which is what lets a row satisfy the structural
// `{ [key: string]: unknown }` props on the shared image pickers. The generated
// type it replaces was an alias, so an interface here breaks those call sites.
export type UserImageRow = {
  id: string
  user_id: string
  title: string
  description: string | null
  storage_path: string | null
  thumbnail_path: string | null
  /** The clip's last frame, stored like `thumbnail_path` (#512). Null for stills. */
  end_frame_path: string | null
  file_name: string | null
  /** bigint in the database; selected as `file_size::float8`. */
  file_size: number | null
  mime_type: string | null
  file_hash: string | null
  width: number | null
  height: number | null
  source: string
  /** Surface the image was made on: `upload | images | canvas` (#207). */
  origin: string
  generation_metadata: Json | null
  request_id: string | null
  status: string
  generation_error: string | null
  idempotency_key: string | null
  color_palette: Json | null
  sort_order: number | null
  group_position: number | null
  /** The one group this image sits in, or null for top level (#319). */
  group_id: string | null
  /** timestamptz; selected as an ISO string. */
  deleted_at: string | null
  /** Hidden from the grid without being trashed (#504). timestamptz; selected
   *  as an ISO string. Independent of `deleted_at`. */
  hidden_at: string | null
  /** timestamptz; selected as an ISO string. */
  created_at: string
  /** timestamptz; selected as an ISO string. */
  updated_at: string
}
