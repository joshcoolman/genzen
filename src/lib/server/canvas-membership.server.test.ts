import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  addCanvasMembers,
  clearCanvasMembership,
  listCanvasMemberIds,
  removeCanvasMembers,
  requireCanvas,
} from './canvas-membership.server'
import { sql } from './db.server'

// Membership is now rows (#212), so these are the guarantees the canvas reads
// depend on: one card per image, position that survives being written to twice,
// membership that a trash clears off every board, and an id from the browser
// that cannot name a board someone else owns (#446).
//
// Runs against the local Postgres from docker-compose (DATABASE_URL), like
// `credentials.server.test.ts`. A real database rather than a mock is the whole
// point: every claim here is a constraint, a cascade or a filter.

const EMAIL = `${randomUUID()}@example.com`
let userId: string
let canvasId: string

/** A canvas of this user's, by name. */
async function makeCanvas(name: string): Promise<string> {
  const [row] = await sql<Array<{ id: string }>>`
    insert into canvases (user_id, name) values (${userId}, ${name})
    returning id
  `
  return row.id
}

/** A completed library image, the way an upload lands. */
async function makeImage(title: string): Promise<string> {
  const [row] = await sql<Array<{ id: string }>>`
    insert into user_images (user_id, title, source, origin, storage_path)
    values (${userId}, ${title}, 'upload', 'upload', ${`${randomUUID()}.png`})
    returning id
  `
  return row.id
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
  canvasId = await makeCanvas('Canvas')
})

afterAll(async () => {
  await sql`delete from users where id = ${userId}`
  await sql.end()
})

describe('requireCanvas', () => {
  it('resolves a canvas this user owns and refuses one they do not', async () => {
    expect(await requireCanvas(userId, canvasId)).toBe(canvasId)

    const [stranger] = await sql<Array<{ id: string }>>`
      insert into users (email, password_hash)
      values (${`${randomUUID()}@example.com`}, 'unused')
      returning id
    `
    const [theirs] = await sql<Array<{ id: string }>>`
      insert into canvases (user_id, name) values (${stranger.id}, 'Theirs')
      returning id
    `

    // The id reaches the server from the browser now that a board is
    // addressable (#446), and `canvas_images` carries user_id from
    // resolveAuth() -- so without this check a forged id would file your row
    // into someone else's board.
    await expect(requireCanvas(userId, theirs.id)).rejects.toThrow(
      /Canvas not found/,
    )

    await sql`delete from users where id = ${stranger.id}`
  })
})

describe('membership', () => {
  it('adds, re-adds without duplicating, and removes', async () => {
    const a = await makeImage('a')
    const b = await makeImage('b')

    await addCanvasMembers(userId, canvasId, [{ imageId: a }, { imageId: b }])
    expect(await memberIds()).toEqual([a, b].sort())

    // `unique (canvas_id, image_id)` -- one card per image per canvas, which is
    // what makes the old mount-time dedupe undefinable rather than fixed.
    await addCanvasMembers(userId, canvasId, [{ imageId: a }])
    expect(await memberIds()).toEqual([a, b].sort())

    await removeCanvasMembers(userId, canvasId, [a])
    expect(await memberIds()).toEqual([b])
  })

  it('clears off every canvas at once, whatever board the card is on', async () => {
    const c = await makeImage('c')
    const secondId = await makeCanvas('Second')
    await addCanvasMembers(userId, canvasId, [
      { imageId: c, x: 40, y: 50, width: 200, height: 300 },
    ])
    await addCanvasMembers(userId, secondId, [
      { imageId: c, x: 0, y: 0, width: 100, height: 100 },
    ])

    // What every soft-delete path calls (#446). A trashed image is on no board,
    // so a restore has one destination and Trash holds nothing it will refuse
    // to destroy -- the chore the old lock created.
    await clearCanvasMembership(userId, [c])

    expect(await memberIds()).not.toContain(c)
    expect(await listCanvasMemberIds(userId, secondId)).toEqual([])

    await sql`delete from canvases where id = ${secondId}`
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
