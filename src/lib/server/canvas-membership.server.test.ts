import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  addCanvasMembers,
  ensureDefaultCanvas,
  listCanvasMemberIds,
  removeCanvasMembers,
} from './canvas-membership.server'
import { sql } from './db.server'

// Step 2 of #212, and the reason the migration could be additive: while both
// representations exist, the set of images on the canvas must be identical from
// either source. Membership-as-rows is not allowed to be *nearly* the same as
// the `on_canvas` boolean it replaces, because the read flip is a silent
// change -- a divergence would show up as a card that quietly stopped coming
// back, which is exactly the class of bug this epic exists to end.
//
// Runs against the local Postgres from docker-compose (DATABASE_URL), like
// `credentials.server.test.ts`. A real database rather than a mock is the whole
// point here: the two facts being compared are foreign keys and a cascade.

const EMAIL = `${randomUUID()}@example.com`
let userId: string
let canvasId: string

/** A completed library image, the way an upload lands. */
async function makeImage(title: string): Promise<string> {
  const [row] = await sql<Array<{ id: string }>>`
    insert into user_images (user_id, title, source, origin, storage_path)
    values (${userId}, ${title}, 'upload', 'upload', ${`${randomUUID()}.png`})
    returning id
  `
  return row.id
}

/** Membership as the boolean says it -- what every read still used at step 2. */
async function onCanvasIds(): Promise<Array<string>> {
  const rows = await sql<Array<{ id: string }>>`
    select id from user_images
    where user_id = ${userId} and on_canvas = true and deleted_at is null
  `
  return rows.map((r) => r.id).sort()
}

async function memberIds(): Promise<Array<string>> {
  return (await listCanvasMemberIds(userId, canvasId)).sort()
}

beforeAll(async () => {
  const [user] = await sql<Array<{ id: string }>>`
    insert into users (email, password_hash)
    values (${EMAIL}, 'unused')
    returning id
  `
  userId = user.id
  canvasId = await ensureDefaultCanvas(userId)
})

afterAll(async () => {
  await sql`delete from users where id = ${userId}`
  await sql.end()
})

describe('ensureDefaultCanvas', () => {
  it('returns the same canvas on every call', async () => {
    expect(await ensureDefaultCanvas(userId)).toBe(canvasId)
    expect(await ensureDefaultCanvas(userId)).toBe(canvasId)

    const [{ count }] = await sql<Array<{ count: string }>>`
      select count(*)::int as count from canvases where user_id = ${userId}
    `
    expect(Number(count)).toBe(1)
  })
})

describe('membership rows and the on_canvas boolean agree', () => {
  it('holds through add, re-add and remove', async () => {
    const a = await makeImage('a')
    const b = await makeImage('b')

    // The dual-write both representations go through in the app is
    // `setImagesOnCanvas`, which is a server action and needs a session. Its two
    // halves are written here directly, in the same order.
    await sql`update user_images set on_canvas = true where id in ${sql([a, b])}`
    await addCanvasMembers(userId, canvasId, [{ imageId: a }, { imageId: b }])

    expect(await memberIds()).toEqual(await onCanvasIds())
    expect(await memberIds()).toEqual([a, b].sort())

    // Re-adding is idempotent: one card per image per canvas, so the sets stay
    // equal rather than the rows gaining a duplicate the boolean cannot have.
    await addCanvasMembers(userId, canvasId, [{ imageId: a }])
    expect(await memberIds()).toEqual(await onCanvasIds())

    await sql`update user_images set on_canvas = false where id = ${a}`
    await removeCanvasMembers(userId, canvasId, [a])

    expect(await memberIds()).toEqual(await onCanvasIds())
    expect(await memberIds()).toEqual([b])
  })

  it('holds when an image is trashed -- from either side', async () => {
    const c = await makeImage('c')
    await sql`update user_images set on_canvas = true where id = ${c}`
    await addCanvasMembers(userId, canvasId, [{ imageId: c }])

    // Trashing is a library operation and touches neither representation's
    // membership (#212). Both hide the image because both filter `deleted_at`.
    await sql`update user_images set deleted_at = now() where id = ${c}`

    expect(await memberIds()).not.toContain(c)
    expect(await memberIds()).toEqual(await onCanvasIds())

    // The membership row survived, so restoring returns the card. This is the
    // behaviour `deleted_at = now(), on_canvas = false` used to destroy.
    await sql`update user_images set deleted_at = null where id = ${c}`
    expect(await memberIds()).toContain(c)
    expect(await memberIds()).toEqual(await onCanvasIds())
  })
})

describe('position', () => {
  it('is all-or-nothing, and an unplaced re-add does not reset it', async () => {
    const d = await makeImage('d')
    await addCanvasMembers(userId, canvasId, [
      { imageId: d, x: 10, y: 20, width: 300, height: 400 },
    ])

    // Re-adding without a position is what the generation insert path does. It
    // must not send a placed card back to unplaced and jump on the next load.
    await addCanvasMembers(userId, canvasId, [{ imageId: d }])

    const [row] = await sql<Array<{ x: number; y: number; width: number }>>`
      select x, y, width from canvas_images
      where canvas_id = ${canvasId} and image_id = ${d}
    `
    expect(row).toMatchObject({ x: 10, y: 20, width: 300 })
  })

  it('rejects a half-specified position', async () => {
    const e = await makeImage('e')
    await expect(
      sql`
        insert into canvas_images (canvas_id, image_id, user_id, x, y)
        values (${canvasId}, ${e}, ${userId}, 5, 5)
      `,
    ).rejects.toThrow(/canvas_images_position_check/)
  })
})

describe('foreign keys', () => {
  it('a hard-deleted image takes its membership row with it', async () => {
    const f = await makeImage('f')
    await addCanvasMembers(userId, canvasId, [{ imageId: f }])

    await sql`delete from user_images where id = ${f}`

    const rows = await sql<Array<{ image_id: string }>>`
      select image_id from canvas_images where image_id = ${f}
    `
    // The cascade is why the mount-time prune (`listDeadRecordIds`) becomes
    // unreachable rather than merely handled: a membership row cannot outlive
    // the image it names.
    expect(rows).toEqual([])
  })

  it('refuses membership for an image that does not exist', async () => {
    await expect(
      addCanvasMembers(userId, canvasId, [{ imageId: randomUUID() }]),
    ).rejects.toThrow(/canvas_images_image_id_fkey/)
  })
})
