import { generationInputIds } from '../generation-inputs'
import type { GenerationInputImage } from '../generation-inputs'
import { sql } from '#/lib/server/db.server'

/**
 * The images a generation was given, resolved against the library.
 *
 * One implementation for every surface that shows them. Activity renders these
 * today; the image card is next (#380), and two readers that agree on the day
 * they are written is how the aliases got out of sync in the first place.
 *
 * `userId` is the caller's resolved identity, never an argument from the
 * client -- an id from `generation_metadata` is not proof of ownership, so the
 * filter is what stops a guessed uuid from returning someone else's row.
 */
export async function resolveGenerationInputs(
  metadata: unknown,
  userId: string,
): Promise<Array<GenerationInputImage>> {
  const ids = generationInputIds(metadata)
  // Short-circuit rather than let an empty `in ()` reach the database, which
  // is a syntax error rather than an empty result.
  if (ids.length === 0) return []

  const rows = await sql<
    Array<{
      id: string
      title: string | null
      storage_path: string | null
      deleted_at: Date | null
    }>
  >`
    select id, title, storage_path, deleted_at from user_images
    where id in ${sql(ids)} and user_id = ${userId}
  `

  const byId = new Map(rows.map((r) => [r.id, r]))

  // Metadata order, not query order. An id with no row survives as a null
  // path: the generation was given something that no longer exists, and
  // dropping it would silently shorten the list of what went in.
  return ids.map((id) => {
    const found = byId.get(id)
    return {
      id,
      title: found?.title ?? null,
      storagePath: found?.storage_path ?? null,
      isDeleted: found?.deleted_at != null,
    }
  })
}
