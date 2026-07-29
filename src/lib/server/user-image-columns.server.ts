import { sql } from './db.server'

/**
 * Every `user_images` column, shaped the way `UserImage` declares it.
 *
 * Stands in for the `select('*')` that PostgREST served, and it cannot just be
 * `*`: the driver returns `timestamptz` as a `Date` and `bigint` as a string,
 * while `UserImage` (generated from the database, but describing what the
 * browser received) says ISO string and number. Selecting the columns by name
 * is also what makes that difference visible instead of leaving a `Date` to
 * surface later as `created_at.slice is not a function`.
 *
 * Must stay in step with `UserImageRow` in `#/lib/types/db` -- the type says
 * what these columns produce, and `db.server.test.ts` fails if they disagree.
 *
 * A function rather than a constant so each caller embeds a fresh fragment.
 */
export function userImageColumns() {
  return sql`
    id, user_id, title, description,
    storage_path, thumbnail_path, file_name,
    file_size::float8 as file_size,
    mime_type, file_hash, width, height,
    source, generation_metadata, request_id, status, generation_error,
    idempotency_key, color_palette, sort_order, on_canvas,
    to_json(deleted_at)#>>'{}' as deleted_at,
    to_json(created_at)#>>'{}' as created_at,
    to_json(updated_at)#>>'{}' as updated_at
  `
}
