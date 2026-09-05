import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportCut, selectedClips } from './export-cut'
import { UPLOAD_CHUNK_BYTES } from './export-policy'
import type { Clip } from './clips'

const clip = (id: string, size = 1): Clip => ({
  id,
  prompt: id,
  model: 'turbo',
  duration: 5,
  blob: new Blob([new Uint8Array(size)]),
  endFrame: new Blob(['frame']),
})
afterEach(() => vi.unstubAllGlobals())
describe('download-only export client', () => {
  it('omits deselected sections while retaining playback order, not click order', () => {
    const clips = [clip('1'), clip('2'), clip('3')]
    expect(
      selectedClips(clips, new Set(['3', '2'])).map((item) => item.id),
    ).toEqual(['2', '3'])
    expect(clips).toHaveLength(3)
  })
  it('uploads a large clip in bounded pieces, then downloads and cleans up', async () => {
    const fetch = vi.fn((_url: string) =>
      Promise.resolve(
        _url.includes('create')
          ? Response.json({ id: 'temporary' })
          : _url.includes('finish')
            ? new Response('mp4')
            : Response.json({ ok: true }),
      ),
    )
    vi.stubGlobal('fetch', fetch)
    const progress = vi.fn()
    const blob = await exportCut(
      [clip('2', UPLOAD_CHUNK_BYTES + 10)],
      progress,
      new AbortController().signal,
    )
    expect(await blob.text()).toBe('mp4')
    const urls = fetch.mock.calls.map(([url]) => url)
    expect(urls.filter((url) => url.includes('upload'))).toHaveLength(2)
    expect(urls[2]).toContain(`offset=${UPLOAD_CHUNK_BYTES}`)
    expect(urls.at(-1)).toContain('discard')
    expect(progress).toHaveBeenLastCalledWith(
      'Ready to download · no copy saved to the library',
    )
  })
  it('cleans up failed uploads and never requests a generation', async () => {
    const fetch = vi.fn((url: string) =>
      Promise.resolve(
        url.includes('create')
          ? Response.json({ id: 'temporary' })
          : new Response(null, { status: 500 }),
      ),
    )
    vi.stubGlobal('fetch', fetch)
    await expect(
      exportCut([clip('2')], vi.fn(), new AbortController().signal),
    ).rejects.toThrow('unchanged')
    expect(fetch.mock.calls.at(-1)?.[0]).toContain('discard')
    expect(
      fetch.mock.calls.every(([url]) => url.startsWith('/director/export?')),
    ).toBe(true)
  })
  it('rejects an empty selection without sending a request', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(
      exportCut([], vi.fn(), new AbortController().signal),
    ).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
})
