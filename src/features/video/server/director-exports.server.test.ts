import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { listVideos } from '../../../../app/(authenticated)/video/_actions/generate-video.action'
import {
  createSession,
  deleteSession,
} from '../../../../app/(authenticated)/director/_lib/sessions.server'
import {
  getExport,
  saveExport,
} from '../../../../app/(authenticated)/director/_lib/exports.server'
import { storeMedia } from '../../../../app/(authenticated)/director/_lib/media.server'
import {
  permanentlyDeleteImages,
  restoreImages,
} from '../../../../app/(authenticated)/trash/_actions/trash'
import {
  publishDirectorExport,
  publishDirectorExports,
} from './director-exports.server'
import { jsonb, sql } from '#/lib/server/db.server'
import { getAccountStats } from '#/lib/server/account-stats.server'
import { listActivity } from '#/features/activity/server/list-activity.action'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  copy: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('#/lib/server/auth.server', () => ({ resolveAuth: mocks.auth }))
vi.mock('#/lib/image-storage', () => ({ createImageStorage: () => mocks }))
const objects = new Map<string, Blob>()
let owner: string
let stranger: string
let png: Blob
let webp: Blob
beforeAll(async () => {
  const users = await sql`insert into users (email, password_hash) values
    (${`${randomUUID()}@example.test`}, 'unused'), (${`${randomUUID()}@example.test`}, 'unused') returning id`
  owner = users[0].id
  stranger = users[1].id
  png = new Blob([
    new Uint8Array(
      await sharp({
        create: { width: 320, height: 180, channels: 3, background: '#ffcc00' },
      })
        .png()
        .toBuffer(),
    ),
  ])
  webp = new Blob([
    new Uint8Array(
      await sharp(new Uint8Array(await png.arrayBuffer()))
        .webp()
        .toBuffer(),
    ),
  ])
})
beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ userId: owner })
  mocks.download.mockImplementation((key: string) => {
    if (!objects.has(key)) throw new Error('Missing object')
    return Promise.resolve(objects.get(key))
  })
  mocks.upload.mockImplementation((key: string, blob: Blob | Uint8Array) => {
    objects.set(
      key,
      blob instanceof Blob ? blob : new Blob([new Uint8Array(blob)]),
    )
    return Promise.resolve()
  })
  mocks.copy.mockImplementation((source: string, destination: string) => {
    if (!objects.has(source)) throw new Error('Missing source')
    objects.set(destination, objects.get(source)!)
    return Promise.resolve()
  })
  mocks.remove.mockImplementation((keys: Array<string>) => {
    keys.forEach((key) => objects.delete(key))
    return Promise.resolve()
  })
})
afterAll(async () => {
  await sql`delete from users where id in ${sql([owner, stranger])}`
  await sql.end()
})
async function fixture() {
  const session = await createSession(owner, 'Story')
  const output = {
    mediaId: await storeMedia(
      owner,
      session.id,
      new Blob(['movie'], { type: 'video/mp4' }),
    ),
    thumbnailId: await storeMedia(owner, session.id, webp),
    endFrameId: await storeMedia(owner, session.id, png),
    duration: 167,
  }
  const input = {
    id: randomUUID(),
    name: 'My rough cut',
    source: [
      { ...output, id: randomUUID(), prompt: 'Yellow Corvette', model: 'test' },
    ],
  }
  return { session, output, input }
}
async function oldExport() {
  const f = await fixture()
  await sql`insert into director_exports (id, session_id, user_id, name, media_id, thumbnail_id, end_frame_id, duration, source)
    values (${f.input.id}, ${f.session.id}, ${owner}, ${f.input.name}, ${f.output.mediaId}, ${f.output.thumbnailId}, ${f.output.endFrameId}, 167, ${jsonb(f.input.source)})`
  return f
}
it('publishes saves and backfills existing exports into the shared video list exactly once, never working clips', async () => {
  const f = await fixture()
  f.input.source[0].prompt = 'Yellow Corvette. '.repeat(100)
  expect(await listVideos()).toHaveLength(0)
  await saveExport(owner, f.session.id, f.input, f.output)
  const old = await oldExport()
  const ids = await Promise.all([
    publishDirectorExport(owner, old.session.id, old.input.id),
    publishDirectorExport(owner, old.session.id, old.input.id),
  ])
  expect(ids[0]).toBe(ids[1])
  const backfill = await oldExport()
  const clips = await listVideos()
  expect(clips).toHaveLength(3)
  expect(
    clips.find((clip) => clip.description === f.input.source[0].prompt),
  ).toBeDefined()
  expect(
    clips.every((clip) => clip.status === 'completed' && clip.has_end_frame),
  ).toBe(true)
  expect(clips[0]).toMatchObject({
    width: 320,
    height: 180,
    generation_metadata: { duration_seconds: 167 },
  })
  expect(
    clips.find(
      (clip) =>
        (
          clip.generation_metadata?.director_source as
            | { export_id: string }
            | undefined
        )?.export_id === backfill.input.id,
    ),
  ).toBeDefined()
  await publishDirectorExports(owner)
  expect(await listVideos()).toHaveLength(3)
  expect((await getAccountStats(owner)).videos.count).toBe(0)
  expect((await listActivity({ page: 1, pageSize: 50 })).entries).toHaveLength(
    0,
  )
  mocks.auth.mockResolvedValue({ userId: stranger })
  expect(await listVideos()).toHaveLength(0)
  expect(
    await publishDirectorExport(stranger, f.session.id, f.input.id),
  ).toBeNull()
})
it('gives Video independent bytes that survive Director deletion', async () => {
  const f = await oldExport()
  const id = await publishDirectorExport(owner, f.session.id, f.input.id)
  const [row] =
    await sql`select storage_path, thumbnail_path, end_frame_path, generation_metadata from user_images where user_id = ${owner} and id = ${id}`
  await deleteSession(owner, f.session.id)
  for (const key of [row.storage_path, row.thumbnail_path, row.end_frame_path])
    expect(objects.has(key)).toBe(true)
  expect(await objects.get(row.storage_path)!.text()).toBe('movie')
  expect(row.generation_metadata.director_source).toMatchObject({
    session_name: 'Story',
    export_id: f.input.id,
    script: ['Yellow Corvette'],
  })
  expect((await listVideos()).some((clip) => clip.id === id)).toBe(true)
})
it('supports Trash/restore/permanent deletion without damaging or republishing the original', async () => {
  const f = await oldExport()
  const id = await publishDirectorExport(owner, f.session.id, f.input.id)
  const [row] =
    await sql`select storage_path, thumbnail_path, end_frame_path from user_images where user_id = ${owner} and id = ${id}`
  await sql`update user_images set deleted_at = now() where user_id = ${owner} and id = ${id}`
  expect((await listVideos()).some((clip) => clip.id === id)).toBe(false)
  await restoreImages([id!])
  expect((await listVideos()).some((clip) => clip.id === id)).toBe(true)
  await sql`update user_images set deleted_at = now() where user_id = ${owner} and id = ${id}`
  await permanentlyDeleteImages([id!])
  for (const key of [row.storage_path, row.thumbnail_path, row.end_frame_path])
    expect(objects.has(key)).toBe(false)
  expect(await getExport(owner, f.session.id, f.input.id)).not.toBeNull()
  expect(await publishDirectorExport(owner, f.session.id, f.input.id)).toBe(id)
  expect((await listVideos()).some((clip) => clip.id === id)).toBe(false)
})
it('leaves a saved export retryable when copying fails, with no partial library row', async () => {
  const f = await fixture()
  mocks.copy.mockRejectedValueOnce(new Error('Copy unavailable'))
  await expect(
    saveExport(owner, f.session.id, f.input, f.output),
  ).rejects.toThrow('Copy unavailable')
  expect(await getExport(owner, f.session.id, f.input.id)).not.toBeNull()
  expect(
    await sql`select * from director_export_videos where user_id = ${owner} and export_id = ${f.input.id}`,
  ).toHaveLength(0)
  expect(
    [...objects.keys()].filter((key) =>
      key.includes(`/director-exports/${f.input.id}/`),
    ),
  ).toHaveLength(0)
  await publishDirectorExports(owner)
  expect(
    await sql`select * from director_export_videos where user_id = ${owner} and export_id = ${f.input.id}`,
  ).toHaveLength(1)
})

it('does not block the video library when an old export cannot be copied', async () => {
  const f = await oldExport()
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.copy.mockRejectedValueOnce(new Error('Temporary copy failure'))
  try {
    await expect(listVideos()).resolves.toBeInstanceOf(Array)
    expect(log).toHaveBeenCalledWith(
      '[director-export-publication]',
      f.input.id,
      expect.any(Error),
    )
    expect(
      await sql`select * from director_export_videos where user_id = ${owner} and export_id = ${f.input.id}`,
    ).toHaveLength(0)
    await listVideos()
    expect(
      await sql`select * from director_export_videos where user_id = ${owner} and export_id = ${f.input.id}`,
    ).toHaveLength(1)
  } finally {
    log.mockRestore()
  }
})
