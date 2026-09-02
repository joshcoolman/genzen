import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import ffmpegPath from 'ffmpeg-static'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { stitchTimeline } from './stitch-timeline.server'

const execFileAsync = promisify(execFile)
const ffmpeg = ffmpegPath!

/**
 * Real ffmpeg over real files (#515).
 *
 * The editor's claim is that Export produces a file rather than a playlist, so
 * a mock of the thing that makes the file would test nothing worth testing.
 * These generate clips, cut them, and measure what came out.
 *
 * The three fixtures are deliberately mismatched -- different sizes, different
 * frame rates, one silent -- because a timeline of clips that already agree is
 * the case that was never going to fail.
 */

let dir: string

/** How long a file actually runs, measured by decoding it. */
async function durationOf(file: string): Promise<number> {
  const { stderr } = await execFileAsync(
    ffmpeg,
    ['-i', file, '-f', 'null', '-'],
    {
      maxBuffer: 1024 * 1024 * 8,
    },
  )
  const times = [...stderr.matchAll(/time=(\d+):(\d+):(\d+\.\d+)/g)]
  const last = times.at(-1)
  if (!last) throw new Error(`no time in ffmpeg output for ${file}`)
  return Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3])
}

async function streamsOf(file: string): Promise<string> {
  const { stderr } = await execFileAsync(
    ffmpeg,
    ['-i', file, '-f', 'null', '-'],
    {
      maxBuffer: 1024 * 1024 * 8,
    },
  )
  return stderr
}

/** A test pattern clip. `withAudio` decides whether it carries a tone. */
async function makeClip(
  name: string,
  seconds: number,
  size: string,
  fps: number,
  withAudio: boolean,
): Promise<string> {
  const out = join(dir, name)
  const args = [
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    `testsrc=duration=${seconds}:size=${size}:rate=${fps}`,
  ]
  if (withAudio) {
    args.push('-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}`)
  }
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p')
  if (withAudio) args.push('-c:a', 'aac', '-shortest')
  args.push('-y', out)
  await execFileAsync(ffmpeg, args, { timeout: 60_000 })
  return out
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'genzen-stitch-test-'))
}, 120_000)

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true })
})

describe('stitchTimeline', () => {
  it('joins clips of different sizes, frame rates and audio into one playable file', async () => {
    const landscape = await makeClip('a.mp4', 4, '320x240', 30, true)
    const portrait = await makeClip('b.mp4', 4, '240x320', 24, false)

    const out = join(dir, 'cut.mp4')
    const result = await stitchTimeline(
      [
        { file: landscape, inSeconds: 1, outSeconds: 3 },
        { file: portrait, inSeconds: 0, outSeconds: 2 },
      ],
      out,
      0,
    )

    // Two two-second pieces, cut end to end.
    expect(result.durationSeconds).toBeCloseTo(4, 5)
    expect(await durationOf(out)).toBeGreaterThan(3.5)
    expect(await durationOf(out)).toBeLessThan(4.5)

    // The canvas is the first clip's shape, and the portrait clip was fitted
    // into it rather than stretched to it.
    expect(result.width).toBe(320)
    expect(result.height).toBe(240)

    // A silent source did not produce a file with no audio track, which is
    // what would break the next timeline it appeared on.
    const streams = await streamsOf(out)
    expect(streams).toMatch(/Video:/)
    expect(streams).toMatch(/Audio:/)

    // 4:2:0, not whatever the filter chain settled on. The join first shipped
    // as yuv444p, which libx264 encodes as High 4:4:4 Predictive -- decodable
    // in Chrome and not in QuickTime or Safari, so an export played in the
    // page that made it and nowhere else.
    expect(streams).toMatch(/yuv420p/)
    expect(streams).not.toMatch(/yuv444p/)
  }, 300_000)

  it('a crossfade makes the result shorter by its own length, once per join', async () => {
    const one = await makeClip('c1.mp4', 4, '320x240', 30, true)
    const two = await makeClip('c2.mp4', 4, '320x240', 30, true)
    const three = await makeClip('c3.mp4', 4, '320x240', 30, true)

    const out = join(dir, 'faded.mp4')
    const result = await stitchTimeline(
      [
        { file: one, inSeconds: 0, outSeconds: 3 },
        { file: two, inSeconds: 0, outSeconds: 3 },
        { file: three, inSeconds: 0, outSeconds: 3 },
      ],
      out,
      1,
    )

    // 9 seconds of material, two joins overlapping a second each.
    expect(result.durationSeconds).toBeCloseTo(7, 5)
    const actual = await durationOf(out)
    expect(actual).toBeGreaterThan(6.5)
    expect(actual).toBeLessThan(7.5)
  }, 300_000)

  it('honours in and out points rather than using whole clips', async () => {
    const long = await makeClip('long.mp4', 8, '320x240', 30, true)

    const out = join(dir, 'trimmed.mp4')
    const result = await stitchTimeline(
      [{ file: long, inSeconds: 5, outSeconds: 6.5 }],
      out,
      0,
    )

    expect(result.durationSeconds).toBeCloseTo(1.5, 5)
    expect(await durationOf(out)).toBeLessThan(2)
  }, 300_000)

  it('refuses a crossfade longer than the shortest clip instead of clamping it', async () => {
    const one = await makeClip('s1.mp4', 4, '320x240', 30, true)
    const two = await makeClip('s2.mp4', 4, '320x240', 30, true)

    await expect(
      stitchTimeline(
        [
          { file: one, inSeconds: 0, outSeconds: 3 },
          { file: two, inSeconds: 0, outSeconds: 0.5 },
        ],
        join(dir, 'nope.mp4'),
        1,
      ),
    ).rejects.toThrow(/does not fit/)
  }, 300_000)

  it('refuses an empty timeline and a clip with no length', async () => {
    const one = await makeClip('z.mp4', 2, '320x240', 30, true)

    await expect(stitchTimeline([], join(dir, 'x.mp4'), 0)).rejects.toThrow(
      /nothing on the timeline/,
    )
    await expect(
      stitchTimeline(
        [{ file: one, inSeconds: 1, outSeconds: 1 }],
        join(dir, 'x.mp4'),
        0,
      ),
    ).rejects.toThrow(/no length/)
  }, 300_000)
})
