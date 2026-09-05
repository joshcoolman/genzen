import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import ffmpegPath from 'ffmpeg-static'
import { expect, it } from 'vitest'
import { stitchSilent } from './stitch-silent.server'

const exec = promisify(execFile)
it('joins mixed-size WebM/MP4 in order into one silent H264 MP4', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'genzen-export-test-'))
  try {
    await exec(ffmpegPath!, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=c=red:s=160x90:r=24',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440',
      '-t',
      '0.5',
      '-c:v',
      'libvpx-vp9',
      '-c:a',
      'libopus',
      '-f',
      'webm',
      join(dir, 'source-0'),
    ])
    await exec(ffmpegPath!, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=c=blue:s=96x96:r=30',
      '-t',
      '0.75',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-f',
      'mp4',
      join(dir, 'source-1'),
    ])
    const result = await stitchSilent(dir, [
      { size: 1, duration: 0.5 },
      { size: 1, duration: 0.75 },
    ])
    const { stderr } = await exec(ffmpegPath!, [
      '-hide_banner',
      '-i',
      result,
      '-f',
      'null',
      '-',
    ])
    expect(stderr).toContain('Video: h264')
    expect(stderr).toContain('160x90')
    expect(stderr).not.toContain('Audio:')
    expect(stderr).toContain('Duration: 00:00:01.25')
    for (const [time, channel] of [
      ['0.1', 0],
      ['0.9', 2],
    ] as const) {
      const { stdout } = await exec(
        ffmpegPath!,
        [
          '-loglevel',
          'error',
          '-ss',
          time,
          '-i',
          result,
          '-frames:v',
          '1',
          '-vf',
          'crop=2:2:80:44',
          '-f',
          'rawvideo',
          '-pix_fmt',
          'rgb24',
          '-',
        ],
        { encoding: 'buffer' },
      )
      expect(stdout[channel]).toBeGreaterThan(200)
      expect(stdout[channel === 0 ? 2 : 0]).toBeLessThan(30)
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}, 30000)
