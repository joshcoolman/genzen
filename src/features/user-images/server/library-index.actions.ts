'use server'

import type { ImageOrigin } from '#/lib/types/db'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'

// The reads behind the search overlay (#213).
//
// Two of them, and they are deliberately small: the overlay shows everything
// and filters in the browser, so there is one list read per open and one row
// read per paste. No search parameter reaches the database.
//
// **Why the filtering is client-side.** The overlay's whole job is "show me my
// stuff and let me take a prompt or an image out of it", and a per-keystroke
// round trip is the one thing the ticket forbids -- typing has to be free, not
// fast. A lean row is ~200 bytes, so a library of several thousand images is a
// few hundred KB fetched once when the overlay opens. When that stops being
// true the fix is a trigram GIN index over the same expression this row builds,
// and `pg_trgm` is already installed for it. Building the index now would be
// buying an answer to a question the app has not asked yet.

export interface LibraryIndexRow {
  id: string
  title: string
  /** Which surface made it (#207). The overlay's filter reads this. */
  origin: ImageOrigin
  /** ISO timestamp; the list is ordered by it, newest first. */
  createdAt: string
  /**
   * The prompt the user typed, which is not always the prompt that was sent.
   * Null for an upload, which never had one.
   *
   * `original_prompt` is the pre-enhance text and `typed_prompt` the textarea
   * contents when canvas prepended its `[Image 1, ...]` labels (#210) -- both
   * are what was typed, and `prompt` is the fallback for the rows written
   * before either key existed. Preferring the typed one is the point of the
   * feature: the enhanced string is re-derivable from it, and the reverse is
   * not.
   */
  prompt: string | null
}

export async function listLibraryIndex(): Promise<Array<LibraryIndexRow>> {
  const { userId } = await resolveAuth()

  return sql<Array<LibraryIndexRow>>`
    select
      id,
      title,
      origin,
      to_json(created_at)#>>'{}' as "createdAt",
      coalesce(
        generation_metadata->>'original_prompt',
        generation_metadata->>'typed_prompt',
        generation_metadata->>'prompt'
      ) as prompt
    from user_images
    where user_id = ${userId}
      and deleted_at is null
      and status = 'completed'
      and storage_path is not null
    order by created_at desc
  `
}

export interface LibraryImageRef {
  id: string
  title: string
  storage_path: string
  width: number | null
  height: number | null
}

/**
 * One row, by id, for a paste that carries a reference rather than bytes.
 *
 * The paste happens on a surface that may never have opened the overlay, so it
 * resolves the id itself instead of reading a list someone else loaded. It
 * returns null rather than throwing for an id that names nothing of yours --
 * a stale clipboard is an ordinary thing, not an error.
 */
export async function getLibraryImage(
  id: string,
): Promise<LibraryImageRef | null> {
  const { userId } = await resolveAuth()

  const row = first(
    await sql<Array<LibraryImageRef>>`
      select id, title, storage_path, width, height
      from user_images
      where id = ${id}
        and user_id = ${userId}
        and deleted_at is null
        and storage_path is not null
    `,
  )

  return row ?? null
}
