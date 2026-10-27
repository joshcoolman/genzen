import { beforeEach, expect, it, vi } from 'vitest'
import { copy, del, get, put } from '@vercel/blob'
import { createImageStorage } from './client.server'

vi.mock('@vercel/blob', () => ({
  copy: vi.fn(),
  del: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(copy).mockReset()
  vi.mocked(del).mockReset()
  vi.mocked(get).mockReset()
  vi.mocked(put).mockReset()
})

// The store is private and a row's path is the object's path: no public
// access, no random suffix, and a rewrite lands on the same key (#226, #777).
it('writes privately, at the exact key, overwriting', async () => {
  await createImageStorage().upload('owner/a.png', Buffer.from('x'), {
    contentType: 'image/png',
  })
  expect(put).toHaveBeenCalledWith(
    'owner/a.png',
    expect.anything(),
    expect.objectContaining({
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'image/png',
    }),
  )
})

it('downloads bytes with the stored content type', async () => {
  vi.mocked(get).mockResolvedValueOnce({
    statusCode: 200,
    stream: new Blob(['hello']).stream(),
    headers: new Headers(),
    blob: { contentType: 'text/plain', size: 5 },
  } as Awaited<ReturnType<typeof get>>)
  const blob = await createImageStorage().download('owner/a.txt')
  expect(blob.type).toBe('text/plain')
  expect(await blob.text()).toBe('hello')
  expect(get).toHaveBeenCalledWith('owner/a.txt', { access: 'private' })
})

it('throws on a missing object rather than returning an empty blob', async () => {
  vi.mocked(get).mockResolvedValueOnce(null)
  await expect(createImageStorage().download('owner/gone')).rejects.toThrow(
    'not found',
  )
})

it('copies within the private store, at the exact destination', async () => {
  await createImageStorage().copy('owner/a frame.png', 'owner/video-copy.png')
  expect(copy).toHaveBeenCalledWith(
    'owner/a frame.png',
    'owner/video-copy.png',
    expect.objectContaining({ access: 'private', addRandomSuffix: false }),
  )
})

it('rejects deletion failures so callers retain retry metadata', async () => {
  vi.mocked(del).mockRejectedValueOnce(new Error('boom'))
  await expect(createImageStorage().remove(['failed'])).rejects.toThrow(
    'could not be deleted',
  )
})

it('does nothing for an empty delete', async () => {
  await createImageStorage().remove([])
  expect(del).not.toHaveBeenCalled()
})
