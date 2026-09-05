import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { createSession, deleteSession } from './sessions.server'
import { deleteExport, getExport, saveExport } from './exports.server'
import {
  checkpointFinalCut,
  claimFinalCut,
  createFinalCut,
  deleteFinalCut,
  failFinalCut,
  getFinalCut,
  releaseFinalCut,
  renewFinalCut,
  resumeFinalCut,
  stopFinalCut,
} from './final-cuts.server'
import { storeMedia } from './media.server'
import { sql } from '#/lib/server/db.server'

const storage = vi.hoisted(() => ({ remove: vi.fn(), upload: vi.fn() }))
vi.mock('#/lib/image-storage', () => ({ createImageStorage: () => storage }))
let owner: string
let stranger: string
beforeAll(async () => {
  const users = await sql<
    Array<{ id: string }>
  >`insert into users (email, password_hash)
    values (${`${randomUUID()}@example.test`}, 'unused'), (${`${randomUUID()}@example.test`}, 'unused') returning id`
  owner = users[0].id
  stranger = users[1].id
  storage.remove.mockResolvedValue(undefined)
  storage.upload.mockResolvedValue(undefined)
})
afterAll(async () => {
  await sql`delete from users where id in ${sql([owner, stranger])}`
  await sql.end()
})
async function fixture() {
  const session = await createSession(owner, 'Final Cut test')
  const ids = []
  for (let i = 0; i < 3; i++)
    ids.push(
      await storeMedia(
        owner,
        session.id,
        new Blob(['fixture'], { type: 'video/mp4' }),
      ),
    )
  const output = {
    mediaId: ids[0],
    endFrameId: ids[1],
    thumbnailId: ids[2],
    duration: 5,
  }
  const source = {
    ...output,
    id: randomUUID(),
    prompt: 'Yellow car',
    model: 'fixture',
  }
  const item = await saveExport(
    owner,
    session.id,
    { id: randomUUID(), name: 'Rough', source: [source] },
    output,
  )
  return { session, item }
}
it('owns the export, deduplicates start IDs, and limits concurrent jobs across sessions', async () => {
  const { session, item } = await fixture()
  await expect(
    createFinalCut(stranger, session.id, item.id, randomUUID()),
  ).rejects.toThrow('not found')
  const id = randomUUID()
  const results = await Promise.all([
    createFinalCut(owner, session.id, item.id, id),
    createFinalCut(owner, session.id, item.id, id),
  ])
  expect(results.map((row) => row.id)).toEqual([id, id])
  expect(await getFinalCut(stranger, id)).toBeUndefined()
  const other = await fixture()
  await expect(
    createFinalCut(owner, other.session.id, other.item.id, randomUUID()),
  ).rejects.toThrow('Another Final Cut')
  await expect(deleteExport(owner, session.id, item.id)).rejects.toThrow(
    'active Final Cut',
  )
  await expect(deleteSession(owner, session.id)).rejects.toThrow(
    'active Final Cut',
  )
  await stopFinalCut(owner, id)
  await deleteSession(owner, session.id)
  await deleteSession(owner, other.session.id)
})
it('claims one worker, rejects stale writes, and never resumes an uncertain submission', async () => {
  const { session, item } = await fixture()
  const job = await createFinalCut(owner, session.id, item.id, randomUUID())
  const claimed = await claimFinalCut(owner, job.id)
  const lease = claimed!.lease_id!
  expect(await claimFinalCut(owner, job.id)).toBeUndefined()
  expect(await renewFinalCut(stranger, job.id, lease)).toBe(false)
  await expect(
    checkpointFinalCut(owner, job.id, randomUUID(), 'Bad worker', {}),
  ).rejects.toThrow('expired')
  await checkpointFinalCut(owner, job.id, lease, 'Picture', {
    steps: { picture: { endpoint: 'test' } },
  })
  await failFinalCut(owner, job.id, lease, 'Receipt lost')
  await releaseFinalCut(owner, job.id, lease)
  await expect(resumeFinalCut(owner, job.id)).rejects.toThrow(
    'no saved receipt',
  )
  await deleteSession(owner, session.id)
})
it('resumes known receipts and retains metadata after failed cleanup; deletion removes only that version', async () => {
  const { session, item } = await fixture()
  const job = await createFinalCut(owner, session.id, item.id, randomUUID())
  const claimed = await claimFinalCut(owner, job.id)
  const lease = claimed!.lease_id!
  await storeMedia(
    owner,
    session.id,
    new Blob(['final'], { type: 'video/mp4' }),
    job.id,
  )
  await checkpointFinalCut(owner, job.id, lease, 'Picture', {
    steps: { picture: { endpoint: 'test', requestId: 'receipt' } },
  })
  await failFinalCut(owner, job.id, lease, 'Download failed')
  await releaseFinalCut(owner, job.id, lease)
  await resumeFinalCut(owner, job.id)
  expect(
    (await getFinalCut(owner, job.id))?.work.steps?.picture?.requestId,
  ).toBe('receipt')
  const resumed = await claimFinalCut(owner, job.id)
  await stopFinalCut(owner, job.id)
  await expect(deleteFinalCut(owner, job.id)).rejects.toThrow('worker')
  await expect(
    storeMedia(owner, session.id, new Blob(['late']), job.id),
  ).rejects.toThrow('no longer running')
  await releaseFinalCut(owner, job.id, resumed!.lease_id!)
  storage.remove.mockRejectedValueOnce(new Error('Bucket down'))
  await expect(deleteFinalCut(owner, job.id)).rejects.toThrow('Bucket down')
  expect(await getFinalCut(owner, job.id)).toBeDefined()
  await deleteFinalCut(owner, job.id)
  expect(await getFinalCut(owner, job.id)).toBeUndefined()
  expect(await getExport(owner, session.id, item.id)).not.toBeNull()
  const assets =
    await sql`select id from director_media where user_id = ${owner} and session_id = ${session.id}`
  expect(assets).toHaveLength(3)
  await deleteSession(owner, session.id)
})
