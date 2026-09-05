import 'server-only'
import { execFile } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import ffmpegPath from 'ffmpeg-static'
import sharp from 'sharp'
import type { ExportManifest } from './export-policy'

const exec = promisify(execFile)
/** The editor encoder synthesizes/mixes audio and encodes the final concat.
 * This download-only path normalizes silent sections once, then stream-copies
 * the join. No database, bucket, provider request, or library asset is involved. */
export async function stitchSilent(dir: string, clips: ExportManifest) {
  if (!ffmpegPath) throw new Error('FFmpeg is unavailable on this server.')
  const binary = ffmpegPath
  const signal = AbortSignal.timeout(5 * 60 * 1000)
  const run = (args: Array<string>) =>
    exec(
      binary,
      ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args],
      { timeout: 120000, maxBuffer: 1024 * 1024, signal },
    )
  const poster = join(dir, 'shape.png')
  await run([
    '-protocol_whitelist',
    'file,pipe',
    '-i',
    join(dir, 'source-0'),
    '-frames:v',
    '1',
    poster,
  ])
  const { width, height } = await sharp(poster).metadata()
  if (!width || !height || width > 4096 || height > 4096)
    throw new Error('Unsupported video dimensions.')
  const w = Math.max(2, Math.floor(width / 2) * 2)
  const h = Math.max(2, Math.floor(height / 2) * 2)
  for (const [index, clip] of clips.entries()) {
    await run([
      '-protocol_whitelist',
      'file,pipe',
      '-threads',
      '2',
      '-i',
      join(dir, `source-${index}`),
      '-t',
      String(clip.duration),
      '-map',
      '0:v:0',
      '-an',
      '-sn',
      '-dn',
      '-vf',
      `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,format=yuv420p`,
      '-c:v',
      'libx264',
      '-threads',
      '2',
      '-preset',
      'veryfast',
      '-crf',
      '20',
      join(dir, `segment-${index}.mp4`),
    ])
  }
  const manifest = join(dir, 'segments.txt')
  await writeFile(
    manifest,
    clips.map((_, index) => `file 'segment-${index}.mp4'`).join('\n'),
  )
  const output = join(dir, 'final.mp4')
  await run([
    '-protocol_whitelist',
    'file,pipe',
    '-f',
    'concat',
    '-safe',
    '1',
    '-i',
    manifest,
    '-map',
    '0:v:0',
    '-c:v',
    'copy',
    '-an',
    '-movflags',
    '+faststart',
    output,
  ])
  return output
}
