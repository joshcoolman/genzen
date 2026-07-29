import { first, sql } from './db.server'

// Canvas membership as rows (#212). One place that knows how a canvas is
// resolved and how a membership row is written, because two callers need it and
// they are on opposite sides of the app: the canvas client, and the generation
// insert path -- which tags a row the moment it is reserved so a canvas
// generation is reclaimable after navigating away.
//
// Dual-writes `user_images.on_canvas` alongside the rows for now. That column is
// still what every read uses; it is dropped in its own migration once reads have
// moved, and `canvas-membership.server.test.ts` is what proves the two agree
// until then.

/** The single canvas a user has today, created on first need. */
export async function ensureDefaultCanvas(userId: string): Promise<string> {
  const existing = first(
    await sql<Array<{ id: string }>>`
      select id from canvases
      where user_id = ${userId}
      order by created_at
      limit 1
    `,
  )
  if (existing) return existing.id

  // `on conflict do nothing` is not available here -- there is no unique
  // constraint on user_id, because multiple canvases are the point of the table.
  // Two concurrent first-loads could therefore each insert one; the read above
  // orders by created_at so both sessions still converge on the same canvas.
  const created = first(
    await sql<Array<{ id: string }>>`
      insert into canvases (user_id) values (${userId}) returning id
    `,
  )
  if (!created) throw new Error('Failed to create canvas')
  return created.id
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
 * Membership as the rows say it, for the user's default canvas. The equality
 * test compares this against the `on_canvas` set; nothing else reads it yet.
 */
export async function listCanvasMemberIds(
  userId: string,
  canvasId: string,
): Promise<Array<string>> {
  const rows = await sql<Array<{ image_id: string }>>`
    select ci.image_id
    from canvas_images ci
    join user_images ui on ui.id = ci.image_id
    where ci.user_id = ${userId}
      and ci.canvas_id = ${canvasId}
      and ui.deleted_at is null
  `
  return rows.map((r) => r.image_id)
}
