/**
 * How many rows the server component seeds the gallery with (#328, #330).
 *
 * Its own module because both ends need it and neither can hold it: a
 * `'use server'` file may only export async functions, and the client half is
 * the one that has to notice the seed was truncated.
 *
 * The number that matters is not "how many fit on screen" -- it is "how many
 * rows is it acceptable to re-read on every server action", because a server
 * action re-renders the route and so re-runs the seed read. That happens on
 * every delete, every group write and every poll tick. 120 covers several
 * screens of grid, so the backfill below is rare, and it bounds the redundant
 * read at a size Postgres answers from the `(user_id, sort_order desc)` index
 * without noticing.
 *
 * When the seed comes back full, `use-gallery` fetches the whole list once and
 * replaces it. The grid is never short -- it is briefly first-page-only, on a
 * library big enough that the difference is below a paint.
 */
export const GALLERY_SEED_LIMIT = 120
