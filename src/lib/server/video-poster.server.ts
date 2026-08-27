import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import ffmpegPath from 'ffmpeg-static'
import ffprobe from '@ffprobe-installer/ffprobe'
import sharp from 'sharp'
import { createImageStorage } from '#/lib/image-storage'

const execFileAsync = promisify(execFile)

// Matches `generate-thumbnail.server.ts`. A clip's poster is a thumbnail like
// any other once the frame is out of the container, so it is sized and encoded
// identically -- `/img/[id]?v=thumb` answers for a clip exactly as for a still.
const THUMBNAIL_WIDTH = 400
const THUMBNAIL_QUALITY = 80

// A clip that takes longer than this to yield frame one is not a clip we can
// do anything useful with, and the ingest must not hang on it.
const TIMEOUT_MS = 30_000

export interface VideoPoster {
  thumbnailPath: string
  width: number | null
  height: number | null
  durationSeconds: number | null
}

/**
 * What ffprobe reports about the file, as opposed to what was requested.
 *
 * `duration_seconds` in `generation_metadata` is written at submit time from
 * the request params and never read off the bytes, so the two can disagree --
 * `models.ts` notes MiniMax billing on 1.2x the requested duration. This is the
 * file's own answer.
 */
async function probe(file: string): Promise<{
  width: number | null
  height: number | null
  duration: number | null
}> {
  const { stdout } = await execFileAsync(
    ffprobe.path,
    [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      file,
    ],
    { timeout: TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
  )

  const parsed = JSON.parse(stdout) as {
    streams?: Array<{
      codec_type?: string
      width?: number
      height?: number
      duration?: string
    }>
    format?: { duration?: string }
  }

  const video = parsed.streams?.find((s) => s.codec_type === 'video')
  const rawDuration = video?.duration ?? parsed.format?.duration
  const duration = rawDuration == null ? NaN : Number.parseFloat(rawDuration)

  return {
    width: typeof video?.width === 'number' ? video.width : null,
    height: typeof video?.height === 'number' ? video.height : null,
    duration: Number.isFinite(duration) ? duration : null,
  }
}

/**
 * Decode frame one of a clip, store it as a WebP thumbnail, and read the
 * file's real dimensions and duration while the bytes are in hand (#499).
 *
 * ffmpeg is an npm dependency (`ffmpeg-static`), not a system package, so this
 * behaves the same on a laptop and on Railway and adds no prerequisite to
 * `local:up`. The binaries need their postinstall to run -- they ship
 * non-executable -- which is why `ffmpeg-static` and the `@ffprobe-installer`
 * platform packages are listed in `pnpm-workspace.yaml`'s `allowBuilds`.
 *
 * Returns null on any failure. A clip whose poster cannot be made is still a
 * clip: the row keeps a NULL `thumbnail_path` and the tile falls back to the
 * `<video>` element it used before this existed.
 *
 * Both tools want a seekable file -- an mp4's moov atom may sit at the end --
 * so the bytes go to a temp file rather than down a pipe.
 */
export async function extractVideoPoster(
  userId: string,
  storagePath: string,
  bytes: Uint8Array,
): Promise<VideoPoster | null> {
  if (!ffmpegPath) return null

  let dir: string | null = null
  try {
    dir = await mkdtemp(join(tmpdir(), 'genzen-poster-'))
    const file = join(dir, `${randomUUID()}.mp4`)
    await writeFile(file, bytes)

    const { stdout: frame } = await execFileAsync(
      ffmpegPath,
      [
        '-loglevel',
        'error',
        '-i',
        file,
        '-frames:v',
        '1',
        // PNG rather than MJPEG: sharp re-encodes to WebP either way, and this
        // keeps the one lossy step at the end instead of stacking two.
        '-c:v',
        'png',
        '-f',
        'image2pipe',
        '-',
      ],
      {
        timeout: TIMEOUT_MS,
        maxBuffer: 64 * 1024 * 1024,
        encoding: 'buffer',
      },
    )

    if (!frame.length) return null

    const thumbBuffer = await sharp(frame)
      .resize(THUMBNAIL_WIDTH, null, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toBuffer()

    const filename = storagePath.split('/').pop() ?? storagePath
    const thumbnailPath = `${userId}/thumbs/${filename.replace(/\.[^.]+$/, '.webp')}`

    await createImageStorage().upload(thumbnailPath, thumbBuffer, {
      contentType: 'image/webp',
      upsert: true,
    })

    // A failed probe must not cost the poster that already succeeded.
    let facts: Awaited<ReturnType<typeof probe>>
    try {
      facts = await probe(file)
    } catch {
      facts = { width: null, height: null, duration: null }
    }

    return {
      thumbnailPath,
      width: facts.width,
      height: facts.height,
      durationSeconds: facts.duration,
    }
  } catch {
    return null
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
