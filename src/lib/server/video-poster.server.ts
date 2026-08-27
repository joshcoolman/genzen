import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
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

// How far back from the end to start decoding when hunting the final frame.
// Seeking to the exact end lands past the last frame and decodes nothing, so
// ffmpeg is pointed a second before it and every frame from there is written
// over the same file -- what survives is the last one. A second is enough for
// any frame rate and cheap to decode; on a clip shorter than that the seek
// simply clamps to the start and the whole clip is walked.
const END_SEEK_SECONDS = 1

export interface VideoPoster {
  thumbnailPath: string
  /**
   * The clip's last frame, or null when only that half failed (#512).
   *
   * Its own field rather than a second return: a clip whose final frame will
   * not decode still has a usable poster, and failing the whole extraction
   * would cost the tile, the dimensions and the fallback all at once.
   */
  endFramePath: string | null
  // Always known when a poster exists: sharp read them off the decoded frame,
  // and a frame that could not be decoded returns null for the whole poster.
  width: number
  height: number
}

/** The one encode both frames go through, so a poster and an end frame are the
 *  same size and quality and can never drift apart. */
function toThumbnail(image: sharp.Sharp): Promise<Buffer> {
  return image
    .resize(THUMBNAIL_WIDTH, null, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: THUMBNAIL_QUALITY })
    .toBuffer()
}

/**
 * The last frame ffmpeg can decode out of `file`, as PNG bytes, or null.
 *
 * Writes to a file with `-update 1` rather than piping: from a seek point
 * onwards ffmpeg emits *every* frame, and down a pipe those arrive as a dozen
 * PNGs glued together, which sharp reads as the first one. Overwriting a single
 * file leaves exactly the frame the clip ends on.
 *
 * Null on any failure -- a clip with no readable ending still has a poster.
 */
async function decodeEndFrame(file: string): Promise<Buffer | null> {
  const out = join(dirname(file), `${randomUUID()}.png`)
  try {
    await execFileAsync(
      ffmpegPath!,
      [
        '-loglevel',
        'error',
        // Before `-i`, which is what makes it a seek rather than a filter.
        '-sseof',
        `-${END_SEEK_SECONDS}`,
        '-i',
        file,
        '-update',
        '1',
        '-y',
        out,
      ],
      { timeout: TIMEOUT_MS },
    )
    const frame = await readFile(out)
    return frame.length ? frame : null
  } catch {
    return null
  }
}

/**
 * Decode a clip's first and last frames and store each as a WebP thumbnail
 * (#499, and the end frame in #512).
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
 * **The end frame is a second ffmpeg pass and is allowed to fail alone.**
 * Seeking to the exact end of a container decodes nothing, so `-sseof` starts a
 * second before it and `-update 1` overwrites one file per decoded frame,
 * leaving the last. That is a file rather than a pipe because the pipe form
 * would hand back every frame from the seek point concatenated. Its failure
 * returns `endFramePath: null` and nothing else changes -- a clip that cannot
 * show what it ends on is still a clip that plays.
 *
 * Returns null on any failure of the *first* frame. A clip whose poster cannot
 * be made is still a clip: the row keeps a NULL `thumbnail_path` and the tile
 * falls back to the `<video>` element it used before this existed.
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

    const storage = createImageStorage()
    const filename = storagePath.split('/').pop() ?? storagePath
    const stem = filename.replace(/\.[^.]+$/, '')

    const thumbnailPath = `${userId}/thumbs/${stem}.webp`
    await storage.upload(thumbnailPath, await toThumbnail(image), {
      contentType: 'image/webp',
      upsert: true,
    })

    // `-end` beside the poster, so both frames of a clip sit next to each other
    // under the same prefix and one `thumbs/` sweep still finds everything a
    // clip owns.
    const endFrame = await decodeEndFrame(file)
    let endFramePath: string | null = null
    if (endFrame) {
      endFramePath = `${userId}/thumbs/${stem}-end.webp`
      await storage.upload(endFramePath, await toThumbnail(sharp(endFrame)), {
        contentType: 'image/webp',
        upsert: true,
      })
    }

    return { thumbnailPath, endFramePath, width, height }
  } catch {
    return null
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
