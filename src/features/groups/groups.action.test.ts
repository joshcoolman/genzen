import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  addImagesToGroup,
  createImageGroup,
  listGroupMemberIds,
  listImageGroups,
  reorderGroupImages,
  setGroupOrderMode,
} from './groups.action'
import { sql } from '#/lib/server/db.server'

/**
 * The one safety claim the `kind` column makes (#517): the two namespaces are
 * disjoint. /images must never show a group of clips, /video must never show a
 * group of stills, and a forged request must not be able to mix their members.
 *
 * A real database rather than a mock, like `canvas-membership.server.test.ts`:
 * every claim here is a filter or a default, and a mock would only prove the
 * SQL was written the way the test expects it to be written.
 */

const EMAIL = `${randomUUID()}@example.com`
let userId: string

vi.mock('#/lib/server/auth.server', () => ({
  resolveAuth: vi.fn(async () => ({ userId })),
}))

/** A finished still, the way an upload lands. */
async function makeImage(): Promise<string> {
  const [row] = await sql<Array<{ id: string }>>`
    insert into user_images (user_id, title, source, origin, storage_path)
    values (${userId}, 'still', 'upload', 'upload', ${`${randomUUID()}.png`})
    returning id
  `
  return row.id
}

/** A finished clip: the same table, `source = 'ai_video'`. */
async function makeClip(): Promise<string> {
  const [row] = await sql<Array<{ id: string }>>`
    insert into user_images (user_id, title, source, origin, storage_path)
    values (${userId}, 'clip', 'ai_video', 'images', ${`${randomUUID()}.mp4`})
    returning id
  `
  return row.id
}

async function positionOf(imageId: string): Promise<number | null> {
  const [row] = await sql<Array<{ group_position: number | null }>>`
    select group_position from user_images
    where id = ${imageId} and user_id = ${userId}
  `
  return row.group_position
}

async function groupIdOf(imageId: string): Promise<string | null> {
  const [row] = await sql<Array<{ group_id: string | null }>>`
    select group_id from user_images
    where id = ${imageId} and user_id = ${userId}
  `
  return row.group_id
}

beforeAll(async () => {
  const [user] = await sql<Array<{ id: string }>>`
    insert into users (email, password_hash)
    values (${EMAIL}, 'unused')
    returning id
  `
  userId = user.id
})

afterAll(async () => {
  await sql`delete from users where id = ${userId}`
  await sql.end()
})

describe('group kinds', () => {
  it('lists each kind on its own surface and never the other', async () => {
    await createImageGroup('Stills', [await makeImage()], 'image')
    await createImageGroup('Takes', [await makeClip()], 'video')

    const imageGroups = await listImageGroups('image')
    const videoGroups = await listImageGroups('video')

    expect(imageGroups.map((g) => g.name)).toEqual(['Stills'])
    expect(videoGroups.map((g) => g.name)).toEqual(['Takes'])

    // The whole claim, stated as the sets rather than as two lookups: no id
    // appears on both surfaces.
    const overlap = imageGroups
      .map((g) => g.id)
      .filter((id) => videoGroups.some((g) => g.id === id))
    expect(overlap).toEqual([])
  })

  it('files only the members that match, on create', async () => {
    const still = await makeImage()
    const clip = await makeClip()

    // A request naming both. Only the clip belongs in a video group.
    const write = await createImageGroup('Mixed', [still, clip], 'video')

    expect(write.moved?.ids).toEqual([clip])
    expect(await groupIdOf(clip)).toBe(write.moved?.groupId)
    // The still is untouched rather than errored -- see the migration.
    expect(await groupIdOf(still)).toBeNull()
  })

  it('files only the members that match, on add', async () => {
    const created = await createImageGroup('Later', [], 'video')
    const groupId = created.groups[0].id

    const still = await makeImage()
    const clip = await makeClip()
    const write = await addImagesToGroup(groupId, [still, clip])

    expect(write.moved?.ids).toEqual([clip])
    expect(await groupIdOf(still)).toBeNull()
  })
})

/**
 * The two claims the arrangement rests on (#505): a reorder writes consecutive
 * positions for the group's own members and nothing else's, and turning the
 * order off keeps them -- which is the only reason the toggle can be offered
 * without a confirm.
 */
describe('manual order', () => {
  it('numbers the group and leaves an outsider alone', async () => {
    const [a, b, c] = [await makeImage(), await makeImage(), await makeImage()]
    const created = await createImageGroup('Sequence', [a, b, c], 'image')
    const groupId = created.groups[0].id

    // A loose image named in the request. It is not a member, so it takes no
    // position -- a forged id writes nothing rather than erroring.
    const outsider = await makeImage()

    const write = await reorderGroupImages(groupId, [c, a, outsider, b])

    expect(write.groups[0].manual_order).toBe(true)
    expect(await positionOf(c)).toBe(1)
    expect(await positionOf(a)).toBe(2)
    // Four, not three: the ordinal comes from the list that was sent, and the
    // outsider consumed a number without taking one. Gaps are harmless -- the
    // column is only ever read as an order.
    expect(await positionOf(b)).toBe(4)
    expect(await positionOf(outsider)).toBeNull()

    // And the read follows it: the arranged order, not the chronological one.
    expect(await listGroupMemberIds(groupId)).toEqual([c, a, b])
  })

  it('keeps every position when the order is switched off', async () => {
    const [a, b] = [await makeImage(), await makeImage()]
    const created = await createImageGroup('Kept', [a, b], 'image')
    const groupId = created.groups[0].id

    // Deliberately the reverse of chronological, which is newest first --
    // so the two orders disagree and the read has something to prove.
    await reorderGroupImages(groupId, [a, b])
    const off = await setGroupOrderMode(groupId, false)

    expect(off.groups[0].manual_order).toBe(false)
    expect(await positionOf(a)).toBe(1)
    expect(await positionOf(b)).toBe(2)
    // Chronological again while it is off...
    expect(await listGroupMemberIds(groupId)).toEqual([b, a])

    // ...and the arrangement is still there to come back to.
    const on = await setGroupOrderMode(groupId, true)
    expect(on.groups[0].manual_order).toBe(true)
    expect(await listGroupMemberIds(groupId)).toEqual([a, b])
  })
})
