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
  file_name: string | null
  /** bigint in the database; selected as `file_size::float8`. */
  file_size: number | null
  mime_type: string | null
  file_hash: string | null
  width: number | null
  height: number | null
  source: string
  generation_metadata: Json | null
  request_id: string | null
  status: string
  generation_error: string | null
  idempotency_key: string | null
  color_palette: Json | null
  sort_order: number | null
  hidden: boolean
  on_canvas: boolean
  /** timestamptz; selected as an ISO string. */
  deleted_at: string | null
  /** timestamptz; selected as an ISO string. */
  created_at: string
  /** timestamptz; selected as an ISO string. */
  updated_at: string
}
