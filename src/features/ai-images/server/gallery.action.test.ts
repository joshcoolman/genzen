import { beforeEach, describe, expect, it, vi } from 'vitest'

import { trashGalleryImages } from './gallery.action'
import { sql } from '#/lib/server/db.server'
import { removeImages } from '#/features/user-images/server/remove-images.action'
import { cancelFalRequest } from '#/lib/server/fal-cancel.server'

vi.mock('#/lib/server/auth.server', () => ({
  resolveAuth: vi.fn().mockResolvedValue({ userId: 'user-test' }),
}))

// `sql` is a tagged template, so the mock is a function receiving
// (strings, ...values) and returning whatever the query would have.
vi.mock('#/lib/server/db.server', () => ({
  sql: vi.fn(),
  first: (rows: Array<unknown>) => rows[0],
}))

vi.mock('#/features/user-images/server/remove-images.action', () => ({
  removeImages: vi.fn(),
}))

vi.mock('#/lib/server/fal-cancel.server', () => ({
  cancelFalRequest: vi.fn(),
}))

const mockSql = sql as unknown as ReturnType<typeof vi.fn>

/** The SQL text of the nth `sql` call, whitespace-collapsed. */
function statement(call: number): string {
  const strings = mockSql.mock.calls[call]?.[0] as
    | TemplateStringsArray
    | undefined
  return (strings?.join(' ') ?? '').replace(/\s+/g, ' ').trim()
}

/** The interpolated values of the nth `sql` call. */
function values(call: number): Array<unknown> {
  return mockSql.mock.calls[call]?.slice(1) ?? []
}

describe('trashGalleryImages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // The one path in this file that destroys rows. A split that put a completed
  // image in the `delete` half would be silent, permanent data loss -- the
  // picture is gone from Trash too, because it never gets there.
  it('hard-deletes the failed and the cancelled, soft-deletes the rest', async () => {
    mockSql.mockResolvedValueOnce([
      {
        id: 'ok-1',
        status: 'completed',
        request_id: null,
        generation_metadata: null,
        storage_path: 'p1',
        thumbnail_path: null,
      },
      {
        id: 'bad-1',
        status: 'failed',
        request_id: 'req-bad',
        generation_metadata: null,
        storage_path: null,
        thumbnail_path: null,
      },
      {
        id: 'gen-1',
        status: 'pending',
        request_id: 'req-gen',
        generation_metadata: { fal_model_id: 'fal-ai/x' },
        storage_path: null,
        thumbnail_path: null,
      },
    ])
    mockSql.mockResolvedValue([])

    await trashGalleryImages(['ok-1', 'bad-1', 'gen-1'])

    // A pending row is cancelled and destroyed rather than soft-deleted: there
    // is no picture, so Trash has nothing to offer for it (#369).
    expect(statement(1)).toContain('delete from user_images')
    expect(values(1)).toContainEqual(['bad-1', 'gen-1'])

    expect(statement(2)).toContain('update user_images set deleted_at')
    expect(values(2)).toContainEqual(['ok-1'])
  })

  // Trashing a generating card used to leave FAL running: it finished the
  // picture, billed for it, and filed it in Trash.
  it('cancels a generation in flight, and only that one', async () => {
    mockSql.mockResolvedValueOnce([
      {
        id: 'gen-1',
        status: 'pending',
        request_id: 'req-gen',
        generation_metadata: { fal_model_id: 'fal-ai/x' },
        storage_path: null,
        thumbnail_path: null,
      },
      {
        id: 'ok-1',
        status: 'completed',
        request_id: 'req-done',
        generation_metadata: { fal_model_id: 'fal-ai/x' },
        storage_path: 'p1',
        thumbnail_path: null,
      },
    ])
    mockSql.mockResolvedValue([])

    await trashGalleryImages(['gen-1', 'ok-1'])

    expect(cancelFalRequest).toHaveBeenCalledTimes(1)
    expect(cancelFalRequest).toHaveBeenCalledWith('req-gen', {
      fal_model_id: 'fal-ai/x',
    })
  })

  it('removes the objects of a failed row that left some behind', async () => {
    mockSql.mockResolvedValueOnce([
      {
        id: 'bad-1',
        status: 'failed',
        request_id: null,
        generation_metadata: null,
        storage_path: 'a.png',
        thumbnail_path: 'a-thumb.webp',
      },
    ])
    mockSql.mockResolvedValue([])

    await trashGalleryImages(['bad-1'])

    expect(removeImages).toHaveBeenCalledWith({
      storagePaths: ['a.png', 'a-thumb.webp'],
    })
  })

  it('does nothing at all for an empty set', async () => {
    await trashGalleryImages([])

    expect(mockSql).not.toHaveBeenCalled()
  })
})
