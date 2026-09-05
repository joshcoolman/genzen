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

it('assembles silent pictures from audible or silent inputs at the planned duration', async () => {
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
      '-i',
      join(dir, 'clip.mp4'),
      '-an',
      '-c:v',
      'copy',
      join(dir, 'silent.mp4'),
    ])
    const clip = new Blob([await readFile(join(dir, 'clip.mp4'))], {
      type: 'video/mp4',
    })
    const silent = new Blob([await readFile(join(dir, 'silent.mp4'))])
    const output = await assembleFinalCut([
      { blob: () => Promise.resolve(clip), duration: 0.5 },
      { blob: silent, duration: 1.5 },
    ])
    await writeFile(
      join(dir, 'out.mp4'),
      new Uint8Array(await output.arrayBuffer()),
    )
    const { stderr } = await run([
      '-i',
      join(dir, 'out.mp4'),
      '-f',
      'null',
      '-',
    ])
    expect(stderr).toMatch(/Video: h264.*320x180/)
    expect(stderr).not.toContain('Audio:')
    expect(stderr).toContain('Duration: 00:00:02.')
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
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}, 30000)
