import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  addCut,
  addSessionRefs,
  createSession,
  deleteCut,
  deleteSession,
  getSession,
  listSessions,
  openCut,
  patchBoardScenes,
  refKindOf,
  removeSessionRef,
  saveBoard,
  saveRun,
  updateBoardScene,
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
    const cutId = session.cut.id
    const saved = await saveRun(
      owner,
      session.id,
      session.revision,
      clipIds,
      cutId,
    )
    expect(saved.revision).toBe(1)
    expect(saved.cut).toEqual({ id: session.id, name: 'Cut 1', clipIds })

    await expect(
      saveRun(owner, session.id, session.revision, clipIds.slice(0, 1), cutId),
    ).rejects.toThrow('another tab')
    expect((await getSession(owner, session.id))?.cut.clipIds).toEqual(clipIds)

    const reordered = [clipIds[2], clipIds[0], clipIds[1]]
    expect(
      (await saveRun(owner, session.id, saved.revision, reordered, cutId)).cut
        .clipIds,
    ).toEqual(reordered)
  })

  /* A session written before #744 held one bare run; it must open as Cut 1
     with its clips, and keep the same cut id on every read or `active` would
     point at nothing. */
  it('reads a pre-#744 run as Cut 1', async () => {
    const session = await createSession(owner, 'Legacy')
    const clipIds = [randomUUID(), randomUUID()]
    await sql`update director_sessions
      set cut = ${sql.json({ version: 2, clipIds })}
      where id = ${session.id} and user_id = ${owner}`
    const read = await getSession(owner, session.id)
    expect(read?.cuts.cuts).toEqual([
      { id: session.id, name: 'Cut 1', clipIds },
    ])
    expect(read?.cut.id).toBe(session.id)
  })

  /* Cuts: a save lands on the cut it names, not the open one; deleting a cut
     trashes only its clips and opens a neighbour; the last cannot go. */
  it('keeps cuts apart, and never deletes the last', async () => {
    const session = await createSession(owner, 'Cuts')
    const first = session.cut.id
    const firstClips = [randomUUID()]
    let current = await saveRun(
      owner,
      session.id,
      session.revision,
      firstClips,
      first,
    )
    current = await addCut(owner, session.id)
    const second = current.cut.id
    expect(second).not.toBe(first)
    expect(current.cut.name).toBe('Cut 2')
    expect(current.cut.clipIds).toEqual([])

    current = await openCut(owner, session.id, first)
    const secondClips = [randomUUID(), randomUUID()]
    current = await saveRun(
      owner,
      session.id,
      current.revision,
      secondClips,
      second,
    )
    expect(current.cut.id).toBe(first)
    expect(current.cut.clipIds).toEqual(firstClips)
    expect(current.cuts.cuts[1].clipIds).toEqual(secondClips)

    current = await deleteCut(owner, session.id, first)
    expect(current.cuts.cuts.map((cut) => cut.id)).toEqual([second])
    expect(current.cut.id).toBe(second)
    await expect(deleteCut(owner, session.id, second)).rejects.toThrow(
      'last cut',
    )
    expect((await addCut(owner, session.id)).cut.name).toBe('Cut 3')
  })

  /* A session is a name and an order, so deleting one deletes a row. The clips
     are library rows and are not this route's to destroy (#662). */
  it('deletes the session and nothing else', async () => {
    const session = await createSession(owner, 'Delete me')
    await saveRun(
      owner,
      session.id,
      session.revision,
      [randomUUID()],
      session.cut.id,
    )
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

/** A scene with the least that parses, for the board writers below. */
function boardScene(over: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    number: 1,
    line: 'A line.',
    spokenLine: null,
    seconds: 5,
    characterIds: [],
    locationId: null,
    openingPrompt: 'opens',
    closingPrompt: 'closes',
    guidance: null,
    model: null,
    openingId: null,
    closingId: null,
    takes: [],
    ...over,
  } as never
}

describe('Director board writes', () => {
  it('keeps a seed of zero, which a truthiness test used to drop', async () => {
    // `randomInt(0, 2 ** 31)` returns 0 one time in two billion, and zero is a
    // valid seed. Losing it means the board never pins one at all, which is the
    // same-noise-across-sections behaviour the seed is stored for (#703).
    const id = randomUUID()
    await createSession(owner, 'Seed zero', id)
    const saved = await saveBoard(owner, id, [boardScene()], { seed: 0 })
    expect(saved.board.seed).toBe(0)

    // And it survives a later write that does not mention it.
    const again = await saveBoard(owner, id, saved.board.scenes)
    expect(again.board.seed).toBe(0)
  })

  it('patches named scenes without clobbering a concurrent write', async () => {
    /**
     * The bug this exists for: `pronounceBoard` read the scenes, awaited a
     * multi-second Claude call, then wrote the whole array back. The drain
     * writes `closingId`s unattended during exactly that window, and each one
     * landed in the discarded snapshot -- and was orphaned with it, since an id
     * that leaves `boardImageIds` is never drawn and never trashed.
     */
    const id = randomUUID()
    await createSession(owner, 'Concurrent board', id)
    const one = boardScene({ number: 1 })
    const two = boardScene({ number: 2 })
    const start = await saveBoard(owner, id, [one, two])
    const sceneOne = start.board.scenes[0]
    const sceneTwo = start.board.scenes[1]

    // Something else writes while the slow call is in flight.
    const closingId = randomUUID()
    await updateBoardScene(owner, id, sceneTwo.id, { closingId })

    // The slow call lands, carrying only its own field for its own scene.
    const after = await patchBoardScenes(
      owner,
      id,
      new Map([[sceneOne.id, { spokenLine: 'day-KART' }]]),
    )

    expect(after.board.scenes[0].spokenLine).toBe('day-KART')
    // The concurrent write survives, which whole-array writing lost.
    expect(after.board.scenes[1].closingId).toBe(closingId)
  })

  it('leaves a scene it was not given alone, and skips one that has gone', async () => {
    const id = randomUUID()
    await createSession(owner, 'Partial patch', id)
    const start = await saveBoard(owner, id, [boardScene(), boardScene()])
    const after = await patchBoardScenes(
      owner,
      id,
      new Map([
        [start.board.scenes[0].id, { spokenLine: 'said' }],
        // A scene that is not on this board contributes nothing rather than
        // being resurrected.
        [randomUUID(), { spokenLine: 'ghost' }],
      ]),
    )
    expect(after.board.scenes[0].spokenLine).toBe('said')
    expect(after.board.scenes[1].spokenLine).toBeNull()
    expect(after.board.scenes).toHaveLength(2)
  })
})
