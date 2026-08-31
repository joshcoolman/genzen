import { beforeEach, describe, expect, it, vi } from 'vitest'

// Import AFTER the mocks below are hoisted.
import { sql } from './db.server'
import { uploadBufferToFal } from './fal-image-upload.server'
import {
  uploadLibraryImageToFal,
  uploadLibraryImagesToFal,
} from './fal-image-inputs.server'
import type * as DbServer from './db.server'
import { createImageStorage } from '#/lib/image-storage'

// `sql` is a tagged template, so the mock is just a function returning the rows
// the query would have. `first` is the real one -- it only reads rows[0].
vi.mock('./db.server', async () => {
  const actual = await vi.importActual<typeof DbServer>('./db.server')
  return { first: actual.first, sql: vi.fn() }
})

vi.mock('./fal-image-upload.server', () => ({
  uploadBufferToFal: vi.fn(),
}))

vi.mock('#/lib/image-storage', () => ({
  createImageStorage: vi.fn(),
}))

// Same shape the other server-action test uses: `sql` is a tagged template, so
// the mock is a plain function returning the rows the query would have.
const mockSql = sql as unknown as ReturnType<typeof vi.fn>
const mockUpload = vi.mocked(uploadBufferToFal)
const mockStorage = vi.mocked(createImageStorage)

/** A distinct id per test, because the cache is module state that outlives one
 *  `it` -- which is the point of it, and would otherwise make tests order-
 *  dependent. */
let nextId = 0
function freshId() {
  nextId += 1
  return `img-${nextId}`
}

function download(): Promise<Blob> {
  return Promise.resolve({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  } as unknown as Blob)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockStorage.mockReturnValue({
    download: vi.fn(download),
  } as unknown as ReturnType<typeof createImageStorage>)
})

describe('shared FAL uploads (#313)', () => {
  it('uploads once when several calls want the same image at the same time', async () => {
    const id = freshId()
    mockSql.mockResolvedValue([{ id, storage_path: `path/${id}` }])
    mockUpload.mockResolvedValue('https://fal.test/one')

    // Three models submitting together: three concurrent calls, one image.
    const [a, b, c] = await Promise.all([
      uploadLibraryImagesToFal([id], 'user-1'),
      uploadLibraryImagesToFal([id], 'user-1'),
      uploadLibraryImagesToFal([id], 'user-1'),
    ])

    expect(mockUpload).toHaveBeenCalledTimes(1)
    expect(a).toEqual(['https://fal.test/one'])
    expect(b).toEqual(['https://fal.test/one'])
    expect(c).toEqual(['https://fal.test/one'])
  })

  it('does not remember a failed upload', async () => {
    const id = freshId()
    mockSql.mockResolvedValue([{ id, storage_path: `path/${id}` }])
    mockUpload.mockRejectedValueOnce(new Error('bucket blew up'))

    // Throws rather than returning [] since #364 -- a reference that cannot be
    // read must not become a generation you paid for.
    await expect(uploadLibraryImagesToFal([id], 'user-1')).rejects.toThrow(
      /could not be read/,
    )

    // The next caller must try again rather than inherit the rejection.
    mockUpload.mockResolvedValueOnce('https://fal.test/second-try')
    expect(await uploadLibraryImagesToFal([id], 'user-1')).toEqual([
      'https://fal.test/second-try',
    ])
    expect(mockUpload).toHaveBeenCalledTimes(2)
  })

  it('never answers one user with another user’s upload', async () => {
    const id = freshId()
    mockSql.mockResolvedValue([{ id, storage_path: `path/${id}` }])
    mockUpload
      .mockResolvedValueOnce('https://fal.test/mine')
      .mockResolvedValueOnce('https://fal.test/theirs')

    expect(await uploadLibraryImagesToFal([id], 'user-1')).toEqual([
      'https://fal.test/mine',
    ])
    expect(await uploadLibraryImagesToFal([id], 'user-2')).toEqual([
      'https://fal.test/theirs',
    ])
    expect(mockUpload).toHaveBeenCalledTimes(2)
  })

  it('shares one upload between a source and the same image as a reference', async () => {
    const id = freshId()
    mockSql.mockResolvedValue([{ id, storage_path: `path/${id}` }])
    mockUpload.mockResolvedValue('https://fal.test/shared')

    const [source, refs] = await Promise.all([
      uploadLibraryImageToFal(id, 'user-1'),
      uploadLibraryImagesToFal([id], 'user-1'),
    ])

    expect(mockUpload).toHaveBeenCalledTimes(1)
    expect(source).toBe('https://fal.test/shared')
    expect(refs).toEqual(['https://fal.test/shared'])
  })

  it('reports a missing source rather than pretending it uploaded', async () => {
    mockSql.mockResolvedValue([])
    expect(await uploadLibraryImageToFal(freshId(), 'user-1')).toBeNull()
    expect(mockUpload).not.toHaveBeenCalled()
  })
})

/**
 * #364. These are the cases where the old behaviour billed you for a request
 * you did not build.
 */
describe('an unreadable reference fails before FAL is paid (#364)', () => {
  it('throws rather than generating with the references that survived', async () => {
    const good = freshId()
    const gone = freshId()
    // The row for `gone` is absent -- trashed, hard-deleted, never there.
    mockSql.mockResolvedValue([{ id: good, storage_path: `path/${good}` }])
    mockUpload.mockResolvedValue('https://fal.test/good')

    await expect(
      uploadLibraryImagesToFal([good, gone], 'user-1'),
    ).rejects.toThrow(/1 of 2/)
  })

  it('carries the reason the upload failed, not just the count (#556)', async () => {
    // A `catch {}` here once turned a FAL-side refusal into a sentence blaming
    // the library, and there was no way to tell them apart after the fact.
    const id = freshId()
    mockSql.mockResolvedValue([{ id, storage_path: `path/${id}` }])
    mockUpload.mockRejectedValueOnce(new Error('fal said 429'))

    await expect(uploadLibraryImagesToFal([id], 'user-1')).rejects.toThrow(
      /fal said 429/,
    )
  })

  it('says nothing was generated, because nothing was', async () => {
    const gone = freshId()
    mockSql.mockResolvedValue([])
    await expect(uploadLibraryImagesToFal([gone], 'user-1')).rejects.toThrow(
      /Nothing was generated/,
    )
  })

  it('still returns nothing for an empty request, which is not a failure', async () => {
    // No references selected and references-that-could-not-be-read are
    // different facts, and only the second is an error.
    expect(await uploadLibraryImagesToFal([], 'user-1')).toEqual([])
  })
})

/**
 * #556. Eleven references opened eleven concurrent uploads to FAL, and both
 * transport failures seen so far are what concurrency on one shared connection
 * produces. The cap is the part that stops provoking them.
 */
describe('reference uploads are capped, and stay in order', () => {
  it('never runs more than three uploads at once', async () => {
    const ids = Array.from({ length: 11 }, () => freshId())
    mockSql.mockResolvedValue(
      ids.map((id) => ({ id, storage_path: `p/${id}` })),
    )

    let inFlight = 0
    let peak = 0
    mockUpload.mockImplementation(async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 1))
      inFlight--
      return 'https://fal.test/x'
    })

    await uploadLibraryImagesToFal(ids, 'user-1')
    expect(peak).toBeLessThanOrEqual(3)
    expect(mockUpload).toHaveBeenCalledTimes(11)
  })

  it('answers in the caller’s order, not completion order', async () => {
    const ids = Array.from({ length: 6 }, () => freshId())
    mockSql.mockResolvedValue(
      ids.map((id) => ({ id, storage_path: `p/${id}` })),
    )
    // Later items finish first, which is exactly what an unordered gather
    // would scramble: the prompt labels these "[Image 1, Image 2, ...]".
    let n = 0
    mockUpload.mockImplementation(async () => {
      const mine = n++
      await new Promise((r) => setTimeout(r, (6 - mine) * 2))
      return `https://fal.test/${mine}`
    })

    expect(await uploadLibraryImagesToFal(ids, 'user-1')).toEqual([
      'https://fal.test/0',
      'https://fal.test/1',
      'https://fal.test/2',
      'https://fal.test/3',
      'https://fal.test/4',
      'https://fal.test/5',
    ])
  })
})
