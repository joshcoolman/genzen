import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it, vi } from 'vitest'
import ffmpegPath from 'ffmpeg-static'
import sharp from 'sharp'
import { frameCountFor, sharpestIndexes } from './clip-frames.server'

const execFileAsync = promisify(execFile)

/** Every upload the builder makes, so the sheet can be measured. */
const uploads: Array<{ path: string; bytes: Uint8Array }> = []

vi.mock('#/lib/image-storage', () => ({
  createImageStorage: () => ({
    upload: (path: string, bytes: Uint8Array) => {
      uploads.push({ path, bytes })
      return Promise.resolve()
    },
  }),
}))

describe('frameCountFor', () => {
  it('scales with duration between the clamps', () => {
    expect(frameCountFor(30)).toBe(15)
    expect(frameCountFor(90)).toBe(45)
  })

  it('fills the grid for a short clip and caps a long one', () => {
    // A 6s clip would sample three times at the even interval; the floor is
    // what makes it a contact sheet rather than a thumbnail.
    expect(frameCountFor(6)).toBe(12)
    expect(frameCountFor(60 * 30)).toBe(48)
  })

  it('stays under ~2s a tile across everything short form runs to', () => {
    // The reason the interval moved off five seconds: at that rate every clip
    // this app makes landed on the floor and the scaling never fired.
    for (const duration of [24, 45, 60, 90]) {
      expect(duration / frameCountFor(duration)).toBeLessThanOrEqual(2)
    }
  })
})

describe('sharpestIndexes', () => {
  it('steps off a blurred centre onto a clearly sharper neighbour', () => {
    expect(sharpestIndexes([1000, 100, 200, 100, 100, 900])).toEqual([0, 5])
  })

  it('holds the interval when the difference is marginal', () => {
    // The clustering this prevents: two neighbouring tiles, one drifting late
    // and the next early, for a few percent of encoded size.
    expect(sharpestIndexes([105, 100, 104, 106, 100, 103])).toEqual([1, 4])
  })

  it('still yields a tile for a trailing part-group', () => {
    expect(sharpestIndexes([1, 2, 3, 9])).toEqual([2, 3])
  })

  it('gives up a sharper frame rather than sit next to the last tile', () => {
    // Group one would pick index 2 and group two index 3 -- neighbouring
    // frames. The second falls back to its own interval instead.
    expect(sharpestIndexes([100, 100, 900, 900, 100, 100])).toEqual([2, 4])
  })
})

/**
 * Both ends of a clip are on the sheet (#665).
 *
 * The one claim in this file that could not be read off the policy functions:
 * the opening and closing tiles come from two different places -- a forced
 * candidate and a second seek -- and until #665 neither was there at all. Every
 * group hands back its *centre* candidate, so the sheet opened a third of an
 * interval in and closed up to an interval short. As coverage that is a
 * rounding error; as the place a reference image is picked it is the two
 * pictures most worth having.
 *
 * So this decodes a real clip rather than asserting on arithmetic. It is the
 * only test here that runs ffmpeg, which is why it makes its own three-second
 * source and mocks the bucket.
 */
describe('the sheet a clip is sampled into', () => {
  it("opens on the clip's first frame and closes on its last", async () => {
    const { buildClipFrameGrid } = await import('./clip-frames.server')
    const dir = await mkdtemp(join(tmpdir(), 'genzen-grid-test-'))
    try {
      const clip = join(dir, 'clip.mp4')
      await execFileAsync(ffmpegPath!, [
        '-loglevel',
        'error',
        '-f',
        'lavfi',
        '-i',
        'testsrc=size=320x180:rate=24:duration=3',
        '-pix_fmt',
        'yuv420p',
        clip,
      ])

      const grid = await buildClipFrameGrid({
        userId: 'u',
        storagePath: 'u/clips/clip.mp4',
        bytes: new Uint8Array(await readFile(clip)),
        fallbackDuration: 3,
      })

      expect(grid).not.toBeNull()
      // Exactly zero, not near it: `fps=` emits its first frame at t=0, so the
      // opening tile is a candidate that was already decoded.
      expect(grid!.times[0]).toBe(0)
      // And the closing one is the 0.05 short that `captureLastFrame` settled
      // on -- seeking to exactly `duration` decodes nothing.
      expect(grid!.times.at(-1)).toBeCloseTo(2.95, 2)
      expect([...grid!.times].sort((a, b) => a - b)).toEqual(grid!.times)

      // The stack has to hold a cell per timestamp, or the grid slices the
      // wrong picture for every tile after the one that went missing.
      const sheet = uploads.at(-1)
      const meta = await sharp(sheet!.bytes).metadata()
      expect(meta.height).toBe(grid!.tileHeight * grid!.times.length)
      expect(meta.width).toBe(grid!.tileWidth)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }, 60_000)
})
