import { first, sql } from './db.server'

// Canvas membership as rows (#212). One place that knows how a canvas is
// resolved and how a membership row is written, because two callers need it and
// they are on opposite sides of the app: the canvas client, and the generation
// insert path -- which tags a row the moment it is reserved so a canvas
// generation is reclaimable after navigating away.
//
// This is the whole of membership. `user_images.on_canvas` -- a boolean that
// could not name *which* canvas, hold a position, or carry a foreign key -- was
// dropped in `migrations/0005`.

/**
 * Resolve a canvas id the client named, or fail.
 *
 * Every canvas-scoped write takes its id from the browser now that there are
 * several (#446), and `canvas_images` carries `user_id` from `resolveAuth()` --
 * so without this a forged id would file a row of yours into someone else's
 * board. Returns the id so callers read as `const canvasId = await
 * requireCanvas(...)`.
 */
export async function requireCanvas(
  userId: string,
  canvasId: string,
): Promise<string> {
  const found = first(
    await sql<Array<{ id: string }>>`
      select id from canvases
      where id = ${canvasId} and user_id = ${userId}
    `,
  )
  if (!found) throw new Error('Canvas not found')
  return found.id
}

interface MemberPosition {
  imageId: string
  x?: number
  y?: number
  width?: number
  height?: number
}

/**
 * Add images to a canvas. Idempotent per `(canvas_id, image_id)`: re-adding an
 * image already present updates its position rather than duplicating the card.
 *
 * Position is optional. Omitting it means *unplaced*, which is the expected
 * state for a generation whose row is reserved before any client has decided
 * where the card goes -- the client lays out what is unplaced on load.
 *
 * An omitted position `coalesce`s rather than overwriting, so re-adding an image
 * that is already placed does not silently reset it to unplaced and send the
 * card jumping on the next load.
 */
export async function addCanvasMembers(
  userId: string,
  canvasId: string,
  members: Array<MemberPosition>,
): Promise<void> {
  const list = members.filter((m) => m.imageId)
  if (list.length === 0) return

  const rows = list.map((m) => ({
    canvas_id: canvasId,
    image_id: m.imageId,
    user_id: userId,
    x: m.x ?? null,
    y: m.y ?? null,
    width: m.width ?? null,
    height: m.height ?? null,
  }))

  // sql-scope-exempt: an insert scopes by what it writes, and every row carries
  // user_id from the caller's resolveAuth(). There is no filter to add.
  await sql`
    insert into canvas_images ${sql(rows)}
    on conflict (canvas_id, image_id) do update set
      x = coalesce(excluded.x, canvas_images.x),
      y = coalesce(excluded.y, canvas_images.y),
      width = coalesce(excluded.width, canvas_images.width),
      height = coalesce(excluded.height, canvas_images.height)
  `
}

/** Remove images from a canvas. The `user_images` rows are untouched. */
export async function removeCanvasMembers(
  userId: string,
  canvasId: string,
  imageIds: Array<string>,
): Promise<void> {
  const list = imageIds.filter(Boolean)
  if (list.length === 0) return

  await sql`
    delete from canvas_images
    where user_id = ${userId}
      and canvas_id = ${canvasId}
      and image_id in ${sql(list)}
  `
}

/**
 * Take images off every canvas they are on, whatever canvas that is.
 *
 * Called by each soft-delete path (#446): trashing an image clears its canvas
 * membership the same way it clears `group_id`, so restore has one destination
 * -- the library -- and Trash never holds a row it refuses to destroy. The
 * lock and its "Canvas" badge (#212, #375) are gone with it: preserving an
 * image because it was on a board is what made emptying the bin a chore of
 * hunting down boards, and with several boards that chore scales.
 */
export async function clearCanvasMembership(
  userId: string,
  imageIds: Array<string>,
): Promise<void> {
  const list = imageIds.filter(Boolean)
  if (list.length === 0) return

  await sql`
    delete from canvas_images
    where user_id = ${userId} and image_id in ${sql(list)}
  `
}

/**
 * Which images are on a canvas. Membership is the whole answer -- and trashing
 * now clears it (#446), so nothing here is a card the user cannot see.
 */
export async function listCanvasMemberIds(
  userId: string,
  canvasId: string,
): Promise<Array<string>> {
  const rows = await sql<Array<{ image_id: string }>>`
    select ci.image_id
    from canvas_images ci
    where ci.user_id = ${userId}
      and ci.canvas_id = ${canvasId}
  `
  return rows.map((r) => r.image_id)
}
