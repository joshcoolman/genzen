import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  createSession,
  deleteSession,
  getSession,
  listSessions,
  saveDraft,
  saveState,
} from './sessions.server'
import { beginGeneration, dismissGeneration } from './generation.server'
import { sql } from '#/lib/server/db.server'

const mocks = vi.hoisted(() => ({ submit: vi.fn(), remove: vi.fn() }))
vi.mock('../../lab/director/_actions/clips.action', () => ({
  submitClip: mocks.submit,
  checkClip: vi.fn(),
}))
vi.mock('#/lib/image-storage', () => ({
  createImageStorage: () => ({ remove: mocks.remove }),
}))
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
describe('Director durable state', () => {
  it('creates idempotently, isolates owners, and rejects stale writes', async () => {
    const id = randomUUID()
    const session = await createSession(owner, 'First story', id)
    expect((await createSession(owner, 'Ignored duplicate', id)).name).toBe(
      'First story',
    )
    expect(await getSession(stranger, id)).toBeNull()
    await expect(createSession(stranger, 'Stolen', id)).rejects.toThrow(
      'not found',
    )
    const saved = await saveState(owner, session, {
      ...session.cut,
      settings: { ...session.cut.settings, duration: 10 },
    })
    expect(saved.revision).toBe(1)
    await expect(saveState(owner, session, session.cut)).rejects.toThrow(
      'another tab',
    )
    await expect(
      saveState(owner, saved, { ...saved.cut, initialImage: randomUUID() }),
    ).rejects.toThrow('media')
    expect((await listSessions(owner)).some((item) => item.id === id)).toBe(
      true,
    )
    expect(await listSessions(stranger)).toEqual([])
  })
  it('does not let stale draft saves overwrite new text', async () => {
    const session = await createSession(owner, 'Draft')
    await saveDraft(owner, session.id, 'new text', '')
    await expect(
      saveDraft(owner, session.id, 'stale text', ''),
    ).rejects.toThrow('another tab')
    expect((await getSession(owner, session.id))?.draft).toBe('new text')
  })
  it('retains submission identity after dismissal and never spends again on replay', async () => {
    mocks.submit.mockResolvedValue('signed-receipt')
    const session = await createSession(owner, 'Generation')
    const requestId = randomUUID()
    const submitted = await beginGeneration(
      owner,
      session.id,
      0,
      requestId,
      'A sailboat at sea',
      false,
    )
    expect(submitted.cut.pending?.token).toBe('signed-receipt')
    await beginGeneration(
      owner,
      session.id,
      0,
      requestId,
      'A sailboat at sea',
      false,
    )
    await dismissGeneration(owner, session.id, submitted.revision)
    await beginGeneration(
      owner,
      session.id,
      0,
      requestId,
      'A sailboat at sea',
      false,
    )
    expect(mocks.submit).toHaveBeenCalledOnce()
  })
  it('keeps an uncertain submission durable after a provider failure', async () => {
    mocks.submit.mockReset().mockRejectedValue(new Error('Connection lost'))
    const session = await createSession(owner, 'Uncertain')
    const requestId = randomUUID()
    await expect(
      beginGeneration(owner, session.id, 0, requestId, 'Opening scene', false),
    ).rejects.toThrow('Connection lost')
    const restored = await getSession(owner, session.id)
    expect(restored?.cut.pending?.id).toBe(requestId)
    expect(restored?.cut.pending?.token).toBeUndefined()
    await beginGeneration(
      owner,
      session.id,
      0,
      requestId,
      'Opening scene',
      false,
    )
    expect(mocks.submit).toHaveBeenCalledOnce()
    await expect(deleteSession(owner, session.id)).rejects.toThrow('pending')
  })
  it('retains deletion metadata when bucket cleanup fails', async () => {
    const session = await createSession(owner, 'Delete me')
    await sql`insert into director_media (id, session_id, user_id, storage_path, mime_type, size)
      values (${randomUUID()}, ${session.id}, ${owner}, ${randomUUID()}, 'video/mp4', 1)`
    mocks.remove.mockRejectedValueOnce(new Error('Storage unavailable'))
    await expect(deleteSession(owner, session.id)).rejects.toThrow(
      'Storage unavailable',
    )
    expect(await getSession(owner, session.id)).not.toBeNull()
    mocks.remove.mockResolvedValue(undefined)
    await deleteSession(owner, session.id)
    expect(await getSession(owner, session.id)).toBeNull()
  })
})
