import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { findClipEndFrame } from './find-clip-end-frame.action'
import { stampFrameSource } from './stamp-frame.action'
import { sql } from '#/lib/server/db.server'

/**
 * The four claims that decide whether Continue reuses a frame or writes a
 * duplicate (#542). Each is a filter, so a mock would only prove the SQL says
 * what the test expects it to say -- a real database, like
 * `groups.action.test.ts` and `canvas-membership.server.test.ts`.
 */

const EMAIL = `${randomUUID()}@example.com`
let userId: string

vi.mock('#/lib/server/auth.server', () => ({
  resolveAuth: vi.fn(async () => ({ userId })),
}))

async function makeClip(): Promise<string> {
  const [row] = await sql<Array<{ id: string }>>`
    insert into user_images (user_id, title, source, origin, storage_path)
    values (${userId}, 'clip', 'ai_video', 'images', ${`${randomUUID()}.mp4`})
    returning id
  `
  return row.id
}

async function makeFrame(title = 'Frame'): Promise<string> {
  const [row] = await sql<Array<{ id: string }>>`
    insert into user_images (user_id, title, source, origin, storage_path)
    values (${userId}, ${title}, 'upload', 'upload', ${`${randomUUID()}.png`})
    returning id
  `
  return row.id
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

describe('findClipEndFrame', () => {
  it('finds the end frame already pulled from a clip', async () => {
    const clipId = await makeClip()
    const frameId = await makeFrame('Frame · take one')
    await stampFrameSource({
      imageId: frameId,
      clipId,
      timeSeconds: 4.95,
      kind: 'end',
    })

    const found = await findClipEndFrame({ clipId })

    expect(found).toEqual({ id: frameId, title: 'Frame · take one' })
  })

  it('never hands back a scrubbed frame from the same clip', async () => {
    // The failure this guards: `lab/frames` stamps arbitrary positions in the
    // same clip, and putting a mid-clip frame in the first-frame slot would be
    // worse than the duplicate the reuse exists to prevent.
    const clipId = await makeClip()
    const scrubbed = await makeFrame()
    await stampFrameSource({
      imageId: scrubbed,
      clipId,
      timeSeconds: 1.5,
      kind: 'scrub',
    })

    expect(await findClipEndFrame({ clipId })).toBeNull()
  })

  it('ignores a trashed frame, so Continue extracts a fresh one', async () => {
    const clipId = await makeClip()
    const frameId = await makeFrame()
    await stampFrameSource({
      imageId: frameId,
      clipId,
      timeSeconds: 4.95,
      kind: 'end',
    })
    await sql`update user_images set deleted_at = now() where id = ${frameId}`

    expect(await findClipEndFrame({ clipId })).toBeNull()
  })

  it('does not match a frame stamped before kind existed', async () => {
    // Rows written before #542 carry a `frame_source` with no `kind`. They are
    // not backfilled -- they simply miss once and heal on the next extraction.
    const clipId = await makeClip()
    const frameId = await makeFrame()
    await sql`
      update user_images
      set generation_metadata = ${sql.json({
        frame_source: { clip_id: clipId, time_seconds: 4.95 },
      })}::jsonb
      where id = ${frameId}
    `

    expect(await findClipEndFrame({ clipId })).toBeNull()
  })

  it('does not cross clips', async () => {
    const clipId = await makeClip()
    const otherClipId = await makeClip()
    const frameId = await makeFrame()
    await stampFrameSource({
      imageId: frameId,
      clipId,
      timeSeconds: 4.95,
      kind: 'end',
    })

    expect(await findClipEndFrame({ clipId: otherClipId })).toBeNull()
  })
})
