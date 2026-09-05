import 'server-only'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import ffmpeg from 'ffmpeg-static'
import sharp from 'sharp'
import { sampleTimes } from './final-cut'
import type { SavedExport } from './types'

const exec = promisify(execFile)
async function run(args: Array<string>) {
  if (!ffmpeg) throw new Error('FFmpeg is unavailable.')
  return exec(
    ffmpeg,
    ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args],
    {
      timeout: 180000,
      maxBuffer: 1024 * 1024,
    },
  )
}
export async function extractFinalFrames(blob: Blob, source: SavedExport) {
  const dir = await mkdtemp(join(tmpdir(), 'genzen-final-frames-'))
  try {
    const input = join(dir, 'source.mp4')
    await writeFile(input, new Uint8Array(await blob.arrayBuffer()))
    const frames = []
    for (const sample of sampleTimes(source)) {
      const output = join(dir, 'frame.png')
      await run([
        '-protocol_whitelist',
        'file,pipe',
        '-ss',
        String(sample.time),
        '-i',
        input,
        '-frames:v',
        '1',
        output,
      ])
      const resized = await sharp(output)
        .resize(768, 768, { fit: 'inside' })
        .jpeg({ quality: 88 })
        .toBuffer({ resolveWithObject: true })
      const bytes = await sharp(resized.data)
        .extend({
          top: 0,
          left: 0,
          right: Math.max(0, 256 - resized.info.width),
          bottom: Math.max(0, 256 - resized.info.height),
          background: '#000000',
        })
        .jpeg({ quality: 88 })
        .toBuffer()
      frames.push({
        ...sample,
        blob: new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }),
      })
    }
    return frames
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** Normalize picture-matched effects, join on the planned cuts, then mix one
 * continuous score. Missing audio is an error, never a silent "finished" film. */
export async function assembleFinalCut(
  clips: Array<{ blob: Blob | (() => Promise<Blob>); duration: number }>,
  music: Blob,
) {
  if (!clips.length || clips.length > 12)
    throw new Error('Invalid Final Cut shot count.')
  const dir = await mkdtemp(join(tmpdir(), 'genzen-final-mix-'))
  try {
    for (const [index, clip] of clips.entries()) {
      const blob =
        typeof clip.blob === 'function' ? await clip.blob() : clip.blob
      await writeFile(
        join(dir, `source-${index}.mp4`),
        new Uint8Array(await blob.arrayBuffer()),
      )
    }
    const poster = join(dir, 'shape.png')
    await run([
      '-protocol_whitelist',
      'file,pipe',
      '-i',
      join(dir, 'source-0.mp4'),
      '-frames:v',
      '1',
      poster,
    ])
    const { width, height } = await sharp(poster).metadata()
    if (!width || !height || width > 4096 || height > 4096)
      throw new Error('Unsupported Final Cut dimensions.')
    const w = Math.max(2, Math.floor(width / 2) * 2)
    const h = Math.max(2, Math.floor(height / 2) * 2)
    for (const [index, clip] of clips.entries()) {
      if (
        !Number.isFinite(clip.duration) ||
        clip.duration <= 0 ||
        clip.duration > 15
      )
        throw new Error('Invalid shot duration.')
      await run([
        '-protocol_whitelist',
        'file,pipe',
        '-threads',
        '2',
        '-i',
        join(dir, `source-${index}.mp4`),
        '-t',
        String(clip.duration),
        '-map',
        '0:v:0',
        '-map',
        '0:a:0',
        '-sn',
        '-dn',
        '-vf',
        `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,format=yuv420p,tpad=stop_mode=clone:stop_duration=15`,
        '-af',
        `aresample=48000,apad,atrim=duration=${clip.duration},afade=t=in:d=0.03,afade=t=out:st=${Math.max(0, clip.duration - 0.04)}:d=0.04`,
        '-c:v',
        'libx264',
        '-threads',
        '2',
        '-preset',
        'veryfast',
        '-crf',
        '18',
        '-c:a',
        'aac',
        '-ar',
        '48000',
        '-ac',
        '2',
        join(dir, `segment-${index}.mp4`),
      ])
    }
    await writeFile(
      join(dir, 'segments.txt'),
      clips.map((_, index) => `file 'segment-${index}.mp4'`).join('\n'),
    )
    const joined = join(dir, 'joined.mp4')
    await run([
      '-protocol_whitelist',
      'file,pipe',
      '-f',
      'concat',
      '-safe',
      '1',
      '-i',
      join(dir, 'segments.txt'),
      '-c',
      'copy',
      joined,
    ])
    await writeFile(
      join(dir, 'score'),
      new Uint8Array(await music.arrayBuffer()),
    )
    const duration = clips.reduce((sum, clip) => sum + clip.duration, 0)
    if (duration > 120) throw new Error('Final Cut exceeds two minutes.')
    const output = join(dir, 'final.mp4')
    await run([
      '-protocol_whitelist',
      'file,pipe',
      '-i',
      joined,
      '-protocol_whitelist',
      'file,pipe',
      '-i',
      join(dir, 'score'),
      '-filter_complex',
      `[0:a]aresample=48000,asplit=2[fx][key];[1:a]aresample=48000,apad,atrim=duration=${duration},volume=0.32,afade=t=in:d=0.4,afade=t=out:st=${Math.max(0, duration - 1.5)}:d=1.5[music];[music][key]sidechaincompress=threshold=0.08:ratio=3:attack=20:release=300[ducked];[fx][ducked]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95:level=0[mix]`,
      '-map',
      '0:v:0',
      '-map',
      '[mix]',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-ar',
      '48000',
      '-ac',
      '2',
      '-t',
      String(duration),
      '-movflags',
      '+faststart',
      output,
    ])
    return new Blob([new Uint8Array(await readFile(output))], {
      type: 'video/mp4',
    })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
