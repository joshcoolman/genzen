import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import ffmpegPath from 'ffmpeg-static'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const uploads: Array<{ path: string; body: Buffer; contentType?: string }> = []

vi.mock('#/lib/image-storage', () => ({
  createImageStorage: () => ({
    upload: (
      path: string,
      body: Uint8Array,
      opts?: { contentType?: string },
    ) => {
      uploads.push({
        path,
        body: Buffer.from(body),
        contentType: opts?.contentType,
      })
      return Promise.resolve()
    },
  }),
}))

const { extractVideoPoster } = await import('./video-poster.server')

const execFileAsync = promisify(execFile)

/**
 * A real mp4, synthesised by the same ffmpeg the module uses. The point of
 * these tests is that the binaries are present, executable and invoked with
 * arguments that work -- the failure mode #499 warns about is a green install
 * and a runtime that cannot decode anything.
 */
let dir: string
let clip: Uint8Array

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'genzen-poster-test-'))
  const file = join(dir, 'clip.mp4')
  await execFileAsync(ffmpegPath!, [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'testsrc=size=1280x720:rate=24:duration=3',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    file,
  ])
  clip = await readFile(file)
}, 60_000)

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('extractVideoPoster', () => {
  it('stores frame one as a WebP thumbnail and reads the file’s own facts', async () => {
    uploads.length = 0

    const poster = await extractVideoPoster(
      'user-1',
      'user-1/ai_123_abc.mp4',
      clip,
    )

    expect(poster).not.toBeNull()
    // Beside the clip in the same `thumbs/` folder an image thumbnail uses, so
    // `/img/[id]?v=thumb` needs no video-specific branch.
    expect(poster!.thumbnailPath).toBe('user-1/thumbs/ai_123_abc.webp')
    expect(poster!.width).toBe(1280)
    expect(poster!.height).toBe(720)
    expect(poster!.durationSeconds).toBeCloseTo(3, 1)

    expect(uploads).toHaveLength(1)
    expect(uploads[0].contentType).toBe('image/webp')

    const meta = await sharp(uploads[0].body).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.width).toBe(400)
  }, 60_000)

  it('returns null for bytes that are not a video, uploading nothing', async () => {
    uploads.length = 0

    const poster = await extractVideoPoster(
      'user-1',
      'user-1/broken.mp4',
      new TextEncoder().encode('not an mp4'),
    )

    expect(poster).toBeNull()
    expect(uploads).toHaveLength(0)
  }, 60_000)
})
