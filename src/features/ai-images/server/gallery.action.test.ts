import { beforeEach, describe, expect, it, vi } from 'vitest'

import { trashGalleryImages } from './gallery.action'
import { sql } from '#/lib/server/db.server'
import { removeImages } from '#/features/user-images/server/remove-images.action'

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
  it('hard-deletes only the failed rows and soft-deletes the rest', async () => {
    mockSql.mockResolvedValueOnce([
      {
        id: 'ok-1',
        status: 'completed',
        storage_path: 'p1',
        thumbnail_path: null,
      },
      {
        id: 'bad-1',
        status: 'failed',
        storage_path: null,
        thumbnail_path: null,
      },
      {
        id: 'ok-2',
        status: 'pending',
        storage_path: 'p2',
        thumbnail_path: null,
      },
    ])
    mockSql.mockResolvedValue([])

    await trashGalleryImages(['ok-1', 'bad-1', 'ok-2'])

    expect(statement(1)).toContain('delete from user_images')
    expect(values(1)).toContainEqual(['bad-1'])

    expect(statement(2)).toContain('update user_images set deleted_at')
    expect(values(2)).toContainEqual(['ok-1', 'ok-2'])
  })

  it('removes the objects of a failed row that left some behind', async () => {
    mockSql.mockResolvedValueOnce([
      {
        id: 'bad-1',
        status: 'failed',
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
