'use server'

import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'

// The index's reads and writes: the list of boards, and the three things you
// can do to one from outside it (#446). What happens *inside* a board is
// `[id]/_actions/canvas.ts`; the split is the same one the route has.
//
// Nothing here touches a picture. Deleting a canvas destroys an arrangement --
// the membership rows cascade with it -- and every image it held is still in
// the library, in whatever group it was already in.

/** How many previews a card draws. Five swatches, plus the cover above them. */
const PREVIEW_LIMIT = 6

export interface CanvasSummary {
  id: string
  name: string
  count: number
  /** Newest members first. The first is the cover; the rest are the strip. */
  preview_image_ids: Array<string>
  updated_at: string
}

/**
 * Every canvas this user has, most recently worked in first.
 *
 * `updated_at` is the right sort because the autosave touches it: the board you
 * were just arranging is the one at the front, without anything having to
 * record a "last opened" of its own.
 *
 * Creates nothing. An account with no boards shows an empty state and a button,
 * which is also what deleting your last one leaves behind -- a list that
 * silently re-seeded itself would read as a delete that did not work.
 */
export async function listCanvases(): Promise<Array<CanvasSummary>> {
  const { userId } = await resolveAuth()

  const canvases = await sql<
    Array<{ id: string; name: string; count: number; updated_at: string }>
  >`
    select c.id, c.name,
           to_json(c.updated_at)#>>'{}' as updated_at,
           (
             select count(*)::int from canvas_images ci
             where ci.canvas_id = c.id and ci.user_id = ${userId}
           ) as count
    from canvases c
    where c.user_id = ${userId}
    order by c.updated_at desc
  `

  // Previews for every board in one read rather than one read per card. A
  // window function rather than a lateral join because the cap is per canvas
  // and the rows are already partitioned by it.
  const previews = await sql<Array<{ canvas_id: string; image_id: string }>>`
    select canvas_id, image_id from (
      select ci.canvas_id, ci.image_id,
             row_number() over (
               partition by ci.canvas_id order by ci.created_at desc
             ) as rn
      from canvas_images ci
      join user_images ui on ui.id = ci.image_id
      where ci.user_id = ${userId} and ui.storage_path is not null
    ) ranked
    where rn <= ${PREVIEW_LIMIT}
  `

  const byCanvas = new Map<string, Array<string>>()
  for (const row of previews) {
    const list = byCanvas.get(row.canvas_id) ?? []
    list.push(row.image_id)
    byCanvas.set(row.canvas_id, list)
  }

  return canvases.map((c) => ({
    ...c,
    preview_image_ids: byCanvas.get(c.id) ?? [],
  }))
}

/** Start a board. Returns its id so the caller can go straight into it. */
export async function createCanvas(name: string): Promise<string> {
  const { userId } = await resolveAuth()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('A canvas needs a name')

  const created = first(
    await sql<Array<{ id: string }>>`
      insert into canvases (user_id, name)
      values (${userId}, ${trimmed})
      returning id
    `,
  )
  if (!created) throw new Error('Failed to create canvas')
  return created.id
}

export async function renameCanvas(id: string, name: string): Promise<void> {
  const { userId } = await resolveAuth()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('A canvas needs a name')

  await sql`
    update canvases set name = ${trimmed}
    where id = ${id} and user_id = ${userId}
  `
}

/**
 * Delete a canvas: the arrangement goes, the pictures do not.
 *
 * `canvas_images` cascades on `canvas_id`, so this removes every card in one
 * statement and touches no `user_images` row. That is the whole reason it can
 * be offered without a trip through Trash -- there is nothing here to recover
 * except positions, and a position is not work (#373).
 */
export async function deleteCanvas(id: string): Promise<void> {
  const { userId } = await resolveAuth()

  await sql`
    delete from canvases where id = ${id} and user_id = ${userId}
  `
}
