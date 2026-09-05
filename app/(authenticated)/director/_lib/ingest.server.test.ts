import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import ffmpeg from 'ffmpeg-static'
import sharp from 'sharp'
import { expect, it, vi } from 'vitest'
import { ingestVideo } from './ingest.server'

const mocks = vi.hoisted(() => ({ store: vi.fn(), remove: vi.fn() }))
vi.mock('./media.server', () => ({
  storeMedia: mocks.store,
  removeMedia: mocks.remove,
}))
it('stores playable source, full-size ending frame and a compact poster; cleans partial ingest', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'director-ingest-test-'))
  try {
    await promisify(execFile)(ffmpeg!, [
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=c=green:s=640x360:r=24',
      '-t',
      '1.25',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      join(dir, 'clip.mp4'),
    ])
    const blob = new Blob([await readFile(join(dir, 'clip.mp4'))], {
      type: 'video/mp4',
    })
    mocks.store.mockImplementation(() => Promise.resolve(randomUUID()))
    const result = await ingestVideo('owner', 'session', blob)
    expect(result.duration).toBeCloseTo(1.25, 1)
    expect(mocks.store).toHaveBeenCalledTimes(3)
    const ending = mocks.store.mock.calls[1][2] as Blob
    const poster = mocks.store.mock.calls[2][2] as Blob
    expect(
      (await sharp(new Uint8Array(await ending.arrayBuffer())).metadata())
        .width,
    ).toBe(640)
    expect(
      (await sharp(new Uint8Array(await poster.arrayBuffer())).metadata())
        .width,
    ).toBe(400)
    mocks.store
      .mockReset()
      .mockResolvedValueOnce('first')
      .mockRejectedValueOnce(new Error('Storage failed'))
    await expect(ingestVideo('owner', 'session', blob)).rejects.toThrow(
      'Storage failed',
    )
    expect(mocks.remove).toHaveBeenCalledWith('owner', ['first'])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}, 30000)
