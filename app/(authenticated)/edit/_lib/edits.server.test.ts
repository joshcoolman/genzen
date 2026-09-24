import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createEdit,
  deleteEdit,
  getEdit,
  listEdits,
  saveCut,
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
