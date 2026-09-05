import 'server-only'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import ffmpeg from 'ffmpeg-static'
import sharp from 'sharp'
import { removeMedia, storeMedia } from './media.server'

const exec = promisify(execFile)
export async function ingestVideo(
  owner: string,
  sessionId: string,
  blob: Blob,
) {
  if (!ffmpeg) throw new Error('FFmpeg is unavailable.')
  const binary = ffmpeg
  const dir = await mkdtemp(join(tmpdir(), 'genzen-director-ingest-'))
  const original = join(dir, 'source')
  const source = join(dir, 'seekable.mkv')
  const end = join(dir, 'end.png')
  const poster = join(dir, 'poster.png')
  const stored: Array<string> = []
  const run = (args: Array<string>) =>
    exec(
      binary,
      ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args],
      { timeout: 60000, maxBuffer: 1024 * 1024 },
    )
  try {
    await writeFile(original, new Uint8Array(await blob.arrayBuffer()))
    await run([
      '-protocol_whitelist',
      'file,pipe',
      '-i',
      original,
      '-map',
      '0:v:0',
      '-c',
      'copy',
      source,
    ])
    await run([
      '-protocol_whitelist',
      'file,pipe',
      '-i',
      source,
      '-frames:v',
      '1',
      poster,
    ])
    // Preserve the final frame at its original resolution for continuation.
    await run([
      '-protocol_whitelist',
      'file,pipe',
      '-sseof',
      '-1',
      '-i',
      source,
      '-update',
      '1',
      end,
    ])
    const frame = await readFile(end)
    const shape = await sharp(frame).metadata()
    if (
      !shape.width ||
      !shape.height ||
      shape.width > 4096 ||
      shape.height > 4096
    )
      throw new Error('Unsupported clip dimensions.')
    const thumb = await sharp(poster)
      .resize(400, null, { withoutEnlargement: true })
      .webp()
      .toBuffer()
    const { stderr } = await exec(
      ffmpeg,
      [
        '-hide_banner',
        '-nostdin',
        '-protocol_whitelist',
        'file,pipe',
        '-i',
        source,
        '-map',
        '0:v:0',
        '-c',
        'copy',
        '-f',
        'null',
        '-',
      ],
      { timeout: 60000, maxBuffer: 1024 * 1024 },
    )
    const match = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr)
    const lastTime = [
      ...stderr.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g),
    ].at(-1)
    const time = match ?? lastTime
    const duration = time
      ? Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3])
      : 0
    if (!duration || duration > 1800)
      throw new Error('Unsupported clip duration.')
    const mediaId = await storeMedia(owner, sessionId, blob)
    stored.push(mediaId)
    const endFrameId = await storeMedia(
      owner,
      sessionId,
      new Blob([frame], { type: 'image/png' }),
    )
    stored.push(endFrameId)
    const thumbnailId = await storeMedia(
      owner,
      sessionId,
      new Blob([new Uint8Array(thumb)], { type: 'image/webp' }),
    )
    stored.push(thumbnailId)
    return { mediaId, endFrameId, thumbnailId, duration }
  } catch (error) {
    await removeMedia(owner, stored)
    throw error
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export async function ingestImage(
  owner: string,
  sessionId: string,
  blob: Blob,
) {
  const bytes = await sharp(new Uint8Array(await blob.arrayBuffer()), {
    limitInputPixels: 4096 * 4096,
  })
    .rotate()
    .png()
    .toBuffer()
  return {
    mediaId: await storeMedia(
      owner,
      sessionId,
      new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
    ),
  }
}
