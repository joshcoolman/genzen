import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createEdit,
  deleteEdit,
  getEdit,
  listEditFrames,
  listEdits,
  renameEdit,
  saveCut,
  setEditGroup,
} from './edits.server'
import { sql } from '#/lib/server/db.server'

let owner: string
let stranger: string

beforeAll(async () => {
  for (const target of ['owner', 'stranger']) {
    const [row] = await sql<
      Array<{ id: string }>
    >`insert into users (email, password_hash)
      values (${`${randomUUID()}@example.test`}, 'unused') returning id`
    if (target === 'owner') owner = row.id
    else stranger = row.id
  }
})

afterAll(async () => {
  await sql`delete from users where id in ${sql([owner, stranger])}`
  await sql.end()
})

describe('edits', () => {
  it('creates idempotently, isolates owners, and summarises the cut', async () => {
    const id = randomUUID()
    await createEdit(owner, 'Rough cut', id)
    await createEdit(owner, 'Rough cut again', id)
    expect((await getEdit(owner, id))?.name).toBe('Rough cut')
    expect(await getEdit(stranger, id)).toBeNull()

    const a = randomUUID()
    const b = randomUUID()
    const saved = await saveCut(owner, id, 0, [
      { id: a, in: 0, out: 4 },
      { id: b, in: 1.5, out: 3 },
      { id: a, in: 2, out: 4 },
    ])
    expect(saved.revision).toBe(1)
    expect(saved.cut.clips).toHaveLength(3)

    const [summary] = (await listEdits(owner)).filter((e) => e.id === id)
    expect(summary.count).toBe(3)
    expect(summary.seconds).toBe(7.5)
    expect(summary.thumbnails).toEqual([a, b, a])
  })

  it('names its frames group after itself, one way, and lists live members', async () => {
    const id = randomUUID()
    await createEdit(owner, 'Frames', id)
    const [group] = await sql<Array<{ id: string }>>`
      insert into image_groups (user_id, name, kind)
      values (${owner}, 'Frames', 'image') returning id`
    const [strangers] = await sql<Array<{ id: string }>>`
      insert into image_groups (user_id, name, kind)
      values (${stranger}, 'Not yours', 'image') returning id`
    await expect(setEditGroup(owner, id, strangers.id)).rejects.toThrow()
    await setEditGroup(owner, id, group.id)
    expect((await getEdit(owner, id))?.group_id).toBe(group.id)

    await renameEdit(owner, id, 'Frames, renamed')
    const [named] = await sql<
      Array<{ name: string }>
    >`select name from image_groups where id = ${group.id}`
    expect(named.name).toBe('Frames, renamed')

    const [live] = await sql<Array<{ id: string }>>`
      insert into user_images (user_id, title, origin, group_id)
      values (${owner}, 'kept', 'upload', ${group.id}) returning id`
    await sql`insert into user_images (user_id, title, origin, group_id, deleted_at)
      values (${owner}, 'trashed', 'upload', ${group.id}, now())`
    expect((await listEditFrames(owner, group.id)).map((f) => f.id)).toEqual([
      live.id,
    ])
    expect(await listEditFrames(owner, null)).toEqual([])
  })

  it('refuses a stale revision and a span with no length', async () => {
    const id = randomUUID()
    await createEdit(owner, 'Stale', id)
    await saveCut(owner, id, 0, [{ id: randomUUID(), in: 0, out: 2 }])
    await expect(
      saveCut(owner, id, 0, [{ id: randomUUID(), in: 0, out: 2 }]),
    ).rejects.toThrow(/another tab/)
    await expect(
      saveCut(owner, id, 1, [{ id: randomUUID(), in: 3, out: 3 }]),
    ).rejects.toThrow()
    await deleteEdit(owner, id)
    expect(await getEdit(owner, id)).toBeNull()
  })
})
