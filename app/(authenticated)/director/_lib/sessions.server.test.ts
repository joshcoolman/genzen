import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  addSessionRefs,
  createSession,
  deleteSession,
  getSession,
  listSessions,
  refKindOf,
  removeSessionRef,
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

  /* Every reference asset is additive and the collection is pruned by
     deleting, which is the whole mechanism of the tabs (#690). A second
     extraction must add beside the first rather than replace it, and the
     frames must not accumulate a duplicate every time one is reused. */
  it('adds reference sheets without replacing, and prunes by deleting', async () => {
    const session = await createSession(owner, 'References')
    const [a, b, c] = [randomUUID(), randomUUID(), randomUUID()]
    const frame = randomUUID()

    const once = await addSessionRefs(owner, session.id, { characters: [a] }, [
      frame,
    ])
    expect(once.refs.characters).toEqual([a])

    const twice = await addSessionRefs(
      owner,
      session.id,
      { characters: [b], locations: [c] },
      [frame],
    )
    expect(twice.refs.characters).toEqual([a, b])
    expect(twice.refs.locations).toEqual([c])
    // The same still, cut once: a reused frame is not a second entry.
    expect(twice.refs.frames).toEqual([frame])

    expect(refKindOf(twice, b)).toBe('characters')
    expect(refKindOf(twice, c)).toBe('locations')
    expect(refKindOf(twice, randomUUID())).toBeNull()

    const pruned = await removeSessionRef(owner, session.id, a)
    expect(pruned.refs.characters).toEqual([b])
    expect(pruned.refs.locations).toEqual([c])
    // Frames are on no tab, so deleting a sheet leaves them where they are.
    expect(pruned.refs.frames).toEqual([frame])
  })

  /* A Director-born asset dies with its session (#679, #690). The guard is the
     origin, so a row that is not Director's survives whatever the ids say. */
  it("trashes the session's own sheets, and only those", async () => {
    const session = await createSession(owner, 'Trash with me')
    const [mine] = await sql<Array<{ id: string }>>`
      insert into user_images (user_id, title, source, origin)
      values (${owner}, 'A sheet', 'ai_generated', 'director') returning id`
    const [theirs] = await sql<Array<{ id: string }>>`
      insert into user_images (user_id, title, source, origin)
      values (${owner}, 'An upload', 'upload', 'upload') returning id`

    await addSessionRefs(owner, session.id, { characters: [mine.id] }, [
      theirs.id,
    ])
    await deleteSession(owner, session.id)

    const rows = await sql<Array<{ id: string; deleted_at: string | null }>>`
      select id, to_json(deleted_at)#>>'{}' as deleted_at from user_images
      where user_id = ${owner} and id in ${sql([mine.id, theirs.id])}`
    const byId = new Map(rows.map((row) => [row.id, row.deleted_at]))
    expect(byId.get(mine.id)).not.toBeNull()
    expect(byId.get(theirs.id)).toBeNull()

    await sql`delete from user_images where user_id = ${owner}
      and id in ${sql([mine.id, theirs.id])}`
  })
})
