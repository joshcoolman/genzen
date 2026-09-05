import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import {
  createSession,
  deleteSession,
  getSession,
  saveState,
} from './sessions.server'
import {
  deleteExport,
  getExport,
  listExports,
  prepareExport,
  renameExport,
  saveExport,
} from './exports.server'
import {
  appendUpload,
  completeUpload,
  discardUpload,
  openUpload,
} from './uploads.server'
import type { StoredClip } from './types'
import { sql } from '#/lib/server/db.server'

const mocks = vi.hoisted(() => ({ remove: vi.fn(), ingest: vi.fn() }))
vi.mock('#/features/video/server/director-exports.server', () => ({
  publishDirectorExport: vi.fn(),
}))
vi.mock('#/lib/image-storage', () => ({
  createImageStorage: () => ({ remove: mocks.remove }),
}))
vi.mock('./ingest.server', () => ({
  ingestVideo: mocks.ingest,
  ingestImage: vi.fn(),
}))
let owner: string
let stranger: string
beforeAll(async () => {
  const rows = await sql<
    Array<{ id: string }>
  >`insert into users (email, password_hash)
    values (${`${randomUUID()}@example.test`}, 'unused'), (${`${randomUUID()}@example.test`}, 'unused') returning id`
  owner = rows[0].id
  stranger = rows[1].id
  mocks.remove.mockResolvedValue(undefined)
})
afterAll(async () => {
  await sql`delete from users where id in ${sql([owner, stranger])}`
  await sql.end()
})
async function assets(sessionId: string) {
  const ids = [randomUUID(), randomUUID(), randomUUID()]
  for (const id of ids)
    await sql`insert into director_media (id, session_id, user_id, storage_path, mime_type, size)
    values (${id}, ${sessionId}, ${owner}, ${id}, 'video/mp4', 3)`
  return {
    mediaId: ids[0],
    thumbnailId: ids[1],
    endFrameId: ids[2],
    duration: 1.25,
  }
}
async function fixture() {
  const session = await createSession(owner, 'Export test')
  const clip: StoredClip = {
    ...(await assets(session.id)),
    id: randomUUID(),
    prompt: 'Original section',
    model: 'fixture',
  }
  const saved = await saveState(owner, session, {
    ...session.cut,
    clips: [clip],
  })
  const input = { id: randomUUID(), name: 'First cut', source: [clip] }
  return { session: saved, clip, input }
}
it('saves one immutable snapshot, isolates owners, and removes duplicate retry outputs', async () => {
  const { session, input } = await fixture()
  await prepareExport(owner, session.id, input)
  const output = await assets(session.id)
  const saved = await saveExport(owner, session.id, input, output)
  const retry = await assets(session.id)
  const replay = await saveExport(
    owner,
    session.id,
    { ...input, name: 'Changed retry' },
    retry,
  )
  expect(replay.media_id).toBe(saved.media_id)
  expect(replay.name).toBe('First cut')
  expect(
    await sql`select id from director_media where user_id = ${owner} and id = ${retry.mediaId}`,
  ).toHaveLength(0)
  expect(await getExport(stranger, session.id, saved.id)).toBeNull()
  await expect(
    renameExport(stranger, session.id, saved.id, 'Stolen'),
  ).rejects.toThrow('not found')
  const other = await createSession(owner, 'Other')
  await expect(prepareExport(owner, other.id, input)).rejects.toThrow('source')
  await saveState(owner, session, { ...session.cut, clips: [] })
  expect((await getExport(owner, session.id, saved.id))?.source).toEqual(
    input.source,
  )
  expect(await listExports(owner, session.id)).toHaveLength(1)
})
it('preserves source clips and other exports when deleting; cleanup failure is retryable', async () => {
  const { session, input, clip } = await fixture()
  const first = await saveExport(
    owner,
    session.id,
    input,
    await assets(session.id),
  )
  const second = await saveExport(
    owner,
    session.id,
    { ...input, id: randomUUID(), name: 'Second cut' },
    await assets(session.id),
  )
  mocks.remove.mockRejectedValueOnce(new Error('Bucket unavailable'))
  await expect(deleteExport(owner, session.id, first.id)).rejects.toThrow(
    'Bucket unavailable',
  )
  expect(await getExport(owner, session.id, first.id)).not.toBeNull()
  await deleteExport(owner, session.id, first.id)
  expect(await getExport(owner, session.id, first.id)).toBeNull()
  expect((await getExport(owner, session.id, second.id))?.media_id).toBe(
    second.media_id,
  )
  expect((await getSession(owner, session.id))?.cut.clips).toEqual([clip])
  expect(
    await sql`select id from director_media where user_id = ${owner} and id = ${clip.mediaId}`,
  ).toHaveLength(1)
  await deleteSession(owner, session.id)
  expect(await getExport(owner, session.id, second.id)).toBeNull()
})
it('retries storage with the same uploaded bytes and handles a lost finish response idempotently', async () => {
  const { session, input } = await fixture()
  const upload = await openUpload(owner, {
    sessionId: session.id,
    size: 3,
    type: 'video/mp4',
    savedExport: input,
  })
  await appendUpload(owner, upload, 0, new Uint8Array([1, 2, 3]))
  mocks.ingest.mockRejectedValueOnce(new Error('Storage unavailable'))
  await expect(completeUpload(owner, upload)).rejects.toThrow(
    'Storage unavailable',
  )
  expect(await listExports(owner, session.id)).toHaveLength(0)
  const output = await assets(session.id)
  mocks.ingest.mockResolvedValue(output)
  expect((await completeUpload(owner, upload)).mediaId).toBe(output.mediaId)
  expect((await completeUpload(owner, upload)).mediaId).toBe(output.mediaId)
  await discardUpload(owner, upload)
  const replay = await openUpload(owner, {
    sessionId: session.id,
    size: 3,
    type: 'video/mp4',
    savedExport: input,
  })
  await appendUpload(owner, replay, 0, new Uint8Array([1, 2, 3]))
  expect((await completeUpload(owner, replay)).mediaId).toBe(output.mediaId)
  expect(mocks.ingest).toHaveBeenCalledTimes(2)
  expect(await listExports(owner, session.id)).toHaveLength(1)
  await discardUpload(owner, replay)
})
