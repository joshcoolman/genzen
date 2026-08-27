import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import ffmpegPath from 'ffmpeg-static'
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
  // Always known when a poster exists: sharp read them off the decoded frame,
  // and a frame that could not be decoded returns null for the whole poster.
  width: number
  height: number
}

/**
 * Decode frame one of a clip and store it as a WebP thumbnail (#499).
 *
 * ffmpeg is an npm dependency (`ffmpeg-static`), not a system package, so this
 * behaves the same on a laptop and on Railway and adds no prerequisite to
 * `local:up`. Its binary arrives in a postinstall, which pnpm 11 runs only for
 * packages named in `pnpm-workspace.yaml`'s `allowBuilds` -- miss that and
 * install, build and deploy all go green while the first generation fails.
 *
 * **The clip's dimensions come off the decoded frame, not from a probe.** A
 * poster is the whole video rectangle, so sharp already has the answer, and
 * `ffprobe` would be a second native binary and a second postinstall to learn
 * what is in hand. Duration is the one fact that needs a probe and it is not
 * worth one: `generation_metadata.duration_seconds` is what was requested, and
 * that is the number the estimate was priced on.
 *
 * Returns null on any failure. A clip whose poster cannot be made is still a
 * clip: the row keeps a NULL `thumbnail_path` and the tile falls back to the
 * `<video>` element it used before this existed.
 *
 * ffmpeg wants a seekable file -- an mp4's moov atom may sit at the end -- so
 * the bytes go to a temp file rather than down a pipe.
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

    const image = sharp(frame)
    const { width, height } = await image.metadata()

    const thumbBuffer = await image
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

    return { thumbnailPath, width, height }
  } catch {
    return null
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
