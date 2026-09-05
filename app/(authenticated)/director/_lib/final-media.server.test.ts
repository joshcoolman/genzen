import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import ffmpeg from 'ffmpeg-static'
import sharp from 'sharp'
import { expect, it } from 'vitest'
import { assembleFinalCut, extractFinalFrames } from './final-media.server'
import type { SavedExport } from './types'

it('assembles playable picture, audible effects and score at the planned duration', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'final-mix-test-'))
  const run = (args: Array<string>) =>
    promisify(execFile)(ffmpeg!, ['-hide_banner', '-nostdin', '-y', ...args], {
      maxBuffer: 1024 * 1024,
    })
  try {
    await run([
      '-f',
      'lavfi',
      '-i',
      'testsrc2=s=320x180:r=24',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:sample_rate=48000',
      '-t',
      '1',
      '-c:v',
      'libx264',
      '-c:a',
      'aac',
      join(dir, 'clip.mp4'),
    ])
    await run([
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=220:sample_rate=48000',
      '-t',
      '2',
      join(dir, 'score.wav'),
    ])
    const clip = new Blob([await readFile(join(dir, 'clip.mp4'))], {
      type: 'video/mp4',
    })
    const music = new Blob([await readFile(join(dir, 'score.wav'))], {
      type: 'audio/wav',
    })
    const output = await assembleFinalCut(
      [
        { blob: clip, duration: 1 },
        { blob: clip, duration: 1 },
      ],
      music,
    )
    await writeFile(
      join(dir, 'out.mp4'),
      new Uint8Array(await output.arrayBuffer()),
    )
    const { stderr } = await run([
      '-i',
      join(dir, 'out.mp4'),
      '-af',
      'volumedetect',
      '-f',
      'null',
      '-',
    ])
    expect(stderr).toMatch(/Video: h264.*320x180/)
    expect(stderr).toMatch(/Audio: aac.*48000 Hz, stereo/)
    expect(stderr).toContain('Duration: 00:00:02.')
    const volume = /mean_volume: (-?[\d.]+) dB/.exec(stderr)
    expect(Number(volume?.[1])).toBeGreaterThan(-40)
    const frames = await extractFinalFrames(output, {
      duration: 2,
      source: [{ duration: 1 }, { duration: 1 }],
    } as SavedExport)
    expect(frames).toHaveLength(4)
    expect(frames.every((frame) => frame.blob.size > 100)).toBe(true)
    const size = await sharp(
      new Uint8Array(await frames[0].blob.arrayBuffer()),
    ).metadata()
    expect(size.width).toBeGreaterThanOrEqual(256)
    expect(size.height).toBeGreaterThanOrEqual(256)
    await run([
      '-i',
      join(dir, 'clip.mp4'),
      '-an',
      '-c:v',
      'copy',
      join(dir, 'silent.mp4'),
    ])
    const silent = new Blob([await readFile(join(dir, 'silent.mp4'))])
    await expect(
      assembleFinalCut([{ blob: silent, duration: 1 }], music),
    ).rejects.toThrow()
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}, 30000)
