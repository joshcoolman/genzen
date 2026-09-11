import { beforeEach, expect, it, vi } from 'vitest'
import { saveDerivedImage } from './save-derived-image.server'

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  thumbnail: vi.fn(),
}))
vi.mock('#/lib/server/db.server', () => ({
  sql: mocks.sql,
  first: (rows: Array<unknown>) => rows[0],
  jsonb: (v: unknown) => v,
}))
vi.mock('#/lib/image-storage', () => ({
  createImageStorage: () => ({ upload: mocks.upload, remove: mocks.remove }),
}))
vi.mock('#/lib/server/generate-thumbnail.server', () => ({
  generateThumbnailInBackground: mocks.thumbnail,
}))
const input = {
  userId: 'owner',
  buffer: Buffer.from('pixels'),
  title: 'Frame 1',
  width: 20,
  height: 10,
  groupId: 'group',
  position: 1,
  idempotencyKey: 'owner:batch:frame',
  fingerprint: 'hash',
  metadata: {},
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.remove.mockResolvedValue(undefined)
})
it('returns the same row on retries without uploading again', async () => {
  mocks.sql.mockResolvedValueOnce([{ id: 'existing', fingerprint: 'hash' }])
  expect(await saveDerivedImage(input)).toBe('existing')
  expect(mocks.upload).not.toHaveBeenCalled()
  expect(mocks.sql.mock.calls[0].slice(1)).toEqual([
    'owner',
    input.idempotencyKey,
  ])
})
it('rejects a reused identity with changed crop content', async () => {
  mocks.sql.mockResolvedValueOnce([{ id: 'existing', fingerprint: 'changed' }])
  await expect(saveDerivedImage(input)).rejects.toThrow('different boundaries')
  expect(mocks.upload).not.toHaveBeenCalled()
})
it('rolls back an uploaded object when its row cannot be inserted', async () => {
  mocks.sql
    .mockResolvedValueOnce([])
    .mockRejectedValueOnce(new Error('DB unavailable'))
  await expect(saveDerivedImage(input)).rejects.toThrow('DB unavailable')
  expect(mocks.remove).toHaveBeenCalledWith([mocks.upload.mock.calls[0][0]])
  expect(mocks.thumbnail).not.toHaveBeenCalled()
})
it('reconciles simultaneous retries and cleans up only the losing upload', async () => {
  mocks.sql
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: 'winner', fingerprint: 'hash' }])
  expect(await saveDerivedImage(input)).toBe('winner')
  expect(mocks.remove).toHaveBeenCalledWith([mocks.upload.mock.calls[0][0]])
})
it('creates the normal library thumbnail after a successful insert', async () => {
  mocks.sql.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'new' }])
  expect(await saveDerivedImage(input)).toBe('new')
  expect(mocks.thumbnail).toHaveBeenCalledWith(
    'owner',
    mocks.upload.mock.calls[0][0],
    'new',
  )
})
