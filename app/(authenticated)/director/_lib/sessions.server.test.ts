import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createSession,
  deleteSession,
  getSession,
  listSessions,
  saveRun,
} from './sessions.server'
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

describe('Director sessions', () => {
  it('creates idempotently and isolates owners', async () => {
    const id = randomUUID()
    await createSession(owner, 'First story', id)
    expect((await createSession(owner, 'Ignored duplicate', id)).name).toBe(
      'First story',
    )
    expect(await getSession(stranger, id)).toBeNull()
    await expect(createSession(stranger, 'Stolen', id)).rejects.toThrow(
      'not found',
    )
    expect((await listSessions(owner)).some((item) => item.id === id)).toBe(
      true,
    )
    expect(await listSessions(stranger)).toEqual([])
  })

  /* The run is the whole of a session's state, and the revision is the only
     thing standing between two tabs holding different orders. */
  it('stores the run in order and rejects a stale write', async () => {
    const session = await createSession(owner, 'A run')
    const clipIds = [randomUUID(), randomUUID(), randomUUID()]
    const saved = await saveRun(owner, session.id, session.revision, clipIds)
    expect(saved.revision).toBe(1)
    expect(saved.cut).toEqual({ version: 2, clipIds })

    await expect(
      saveRun(owner, session.id, session.revision, clipIds.slice(0, 1)),
    ).rejects.toThrow('another tab')
    expect((await getSession(owner, session.id))?.cut.clipIds).toEqual(clipIds)

    const reordered = [clipIds[2], clipIds[0], clipIds[1]]
    expect(
      (await saveRun(owner, session.id, saved.revision, reordered)).cut.clipIds,
    ).toEqual(reordered)
  })

  /* A session is a name and an order, so deleting one deletes a row. The clips
     are library rows and are not this route's to destroy (#662). */
  it('deletes the session and nothing else', async () => {
    const session = await createSession(owner, 'Delete me')
    await saveRun(owner, session.id, session.revision, [randomUUID()])
    await deleteSession(stranger, session.id)
    expect(await getSession(owner, session.id)).not.toBeNull()
    await deleteSession(owner, session.id)
    expect(await getSession(owner, session.id)).toBeNull()
  })
})
