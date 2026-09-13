import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import ffmpegPath from 'ffmpeg-static'
import sharp from 'sharp'
import { createImageStorage } from '#/lib/image-storage'

const execFileAsync = promisify(execFile)

/** One decode pass over a whole clip, which is longer work than a poster's one
 *  frame but still bounded -- the clips this app makes run to 30 seconds. */
const SAMPLE_TIMEOUT_MS = 120_000

/** One seek, one frame, the same budget the poster's end frame gets. */
const GRAB_TIMEOUT_MS = 30_000

/** Tile width on the sheet. Two grid columns of a wide dialog at 2x, which is
 *  as much as a picture being judged for "is this the shot" needs. */
const TILE_WIDTH = 320

const SHEET_QUALITY = 80

/**
 * Roughly one frame per this many seconds, then clamped.
 *
 * A 139s clip lands on 28 tiles and a 6s clip on the floor of 12. The point is
 * coverage rather than precision: the grid answers "what is in this clip",
 * and the scrubbing tool for an exact position is `lab/frames`.
 */
const SECONDS_PER_FRAME = 5
const MIN_FRAMES = 12
const MAX_FRAMES = 48

/**
 * How many frames are decoded per tile, of which the sharpest is kept.
 *
 * This is the whole reason the grid is worth having. Even sampling lands
 * wherever it lands, and a clip that moves hands back motion-blurred stills --
 * a blurred reference is not a reference. Three candidates across the interval
 * is enough to step off a blur without tripling a pass that is already one
 * decode.
 */
const CANDIDATES = 3

/** What a built grid records, and what the sheet is sliced by. */
export interface ClipFrameGrid {
  /** Where in the clip each tile came from, in tile order. */
  times: Array<number>
  /** The bucket key of the sprite sheet: the tiles stacked vertically. */
  sheetPath: string
  tileWidth: number
  tileHeight: number
}

/** How many tiles a clip of this length gets. Exported for its test: the
 *  clamps are the whole of the sampling policy. */
export function frameCountFor(duration: number): number {
  const even = Math.round(duration / SECONDS_PER_FRAME)
  return Math.min(Math.max(even, MIN_FRAMES), MAX_FRAMES)
}

/**
 * How much sharper an off-centre candidate must be to displace the centre one.
 *
 * Without it the grid clusters. The first build against a real clip returned
 * tiles at 0.558s and 0.837s -- two neighbouring frames, because one group's
 * pick drifted late and the next one's drifted early, and a contact sheet with
 * a near-duplicate pair in it has lost a tile's worth of coverage. A blur is a
 * large difference in encoded size, not a few percent, so requiring a real win
 * keeps every tile on the interval it was sampled for and still steps off the
 * frames that are actually smeared.
 */
const SHARPNESS_MARGIN = 1.15

/**
 * The index of the sharpest candidate in each group, given their encoded sizes.
 *
 * Split out from the file reading so the policy can be tested: a trailing
 * group shorter than `CANDIDATES` still yields a tile, and the centre
 * candidate -- the one on the even interval -- holds unless another beats it
 * by `SHARPNESS_MARGIN`.
 */
export function sharpestIndexes(sizes: Array<number>): Array<number> {
  const picked: Array<number> = []
  for (let start = 0; start < sizes.length; start += CANDIDATES) {
    const end = Math.min(start + CANDIDATES, sizes.length)
    const centre = start + Math.floor((end - start - 1) / 2)

    // Measured against the centre throughout, not against the running best:
    // compounding the margin would let a group's second challenger need to
    // clear a bar the first one raised.
    const bar = sizes[centre] * SHARPNESS_MARGIN
    let best = centre
    for (let i = start; i < end; i += 1) {
      if (sizes[i] > bar && sizes[i] > sizes[best]) best = i
    }

    // And never next to the tile before it. One group drifting late while the
    // next drifts early puts two neighbouring frames on the sheet -- a visible
    // duplicate pair, and a tile of coverage gone. The margin alone did not
    // stop it on a real clip; this does, by giving up the sharper frame rather
    // than the spread, which is what the grid is for.
    const previous = picked.at(-1)
    picked.push(previous !== undefined && best - previous < 2 ? centre : best)
  }
  return picked
}

/**
 * How long the clip is, in seconds, read off ffmpeg's own banner.
 *
 * `ffprobe` is the tool for this and is a second native binary with a second
 * postinstall, to learn one number that ffmpeg prints on stderr on its way to
 * doing the work anyway. `-f null -` decodes nothing; the line is emitted
 * during header parsing.
 *
 * Null when the container does not declare one, which is the caller's cue to
 * fall back to the duration the generation was priced on.
 */
async function probeDuration(file: string): Promise<number | null> {
  try {
    await execFileAsync(ffmpegPath!, ['-hide_banner', '-i', file], {
      timeout: GRAB_TIMEOUT_MS,
    })
    return null
  } catch (err) {
    // ffmpeg exits non-zero with no output file, which is expected: the banner
    // is on stderr either way.
    const stderr = (err as { stderr?: string }).stderr ?? ''
    const match = /Duration:\s*(\d+):(\d\d):(\d\d\.\d+)/.exec(stderr)
    if (!match) return null
    const [, h, m, s] = match
    const seconds = Number(h) * 3600 + Number(m) * 60 + Number(s)
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null
  }
}

/**
 * The sharpest of each group of candidates, as an index into `files`.
 *
 * **Byte size is the sharpness proxy**, at a fixed JPEG quality: detail costs
 * bits and blur does not, so the largest file in a group is the frame with the
 * most edges in it. A real focus measure (variance of Laplacian) would mean
 * reading every candidate's pixels; this reads a directory listing.
 */
async function pickSharpest(
  dir: string,
  files: Array<string>,
): Promise<Array<number>> {
  const sizes = await Promise.all(
    files.map(async (name) => (await stat(join(dir, name))).size),
  )
  return sharpestIndexes(sizes)
}

/**
 * Sample a clip start to finish and store the tiles as one sprite sheet (#647).
 *
 * **One ffmpeg pass, not N seeks.** `fps=` walks the file once and emits a
 * frame every interval; forty-eight seeks would each re-open the container and
 * would cost more than the decode they are avoiding on a clip this short.
 *
 * **One object, not N.** Twenty-eight tiles is twenty-eight bucket writes and
 * twenty-eight requests every time the sheet opens, for pictures that are only
 * ever shown together. They are stacked into a single WebP and the grid slices
 * it with `background-position`, so a reopen is one cached request.
 *
 * **Full-resolution frames are never materialised here.** Only the tiles, which
 * exist to be chosen between; the chosen ones are re-extracted at full size on
 * import. Storing twenty-eight PNGs per clip is paying storage for the
 * twenty-five nobody wanted.
 *
 * Null on any failure -- a clip whose frames will not decode is still a clip
 * that plays, and the menu item says so rather than the card breaking.
 */
export async function buildClipFrameGrid({
  userId,
  storagePath,
  bytes,
  fallbackDuration,
}: {
  userId: string
  storagePath: string
  bytes: Uint8Array
  /** `generation_metadata.duration_seconds` -- what the clip was asked for,
   *  used only when the container does not declare its own. */
  fallbackDuration: number | null
}): Promise<ClipFrameGrid | null> {
  if (!ffmpegPath) return null

  let dir: string | null = null
  try {
    dir = await mkdtemp(join(tmpdir(), 'genzen-frames-'))
    const file = join(dir, `${randomUUID()}.mp4`)
    await writeFile(file, bytes)

    const duration = (await probeDuration(file)) ?? fallbackDuration
    if (!duration || duration <= 0) return null

    const count = frameCountFor(duration)
    const interval = duration / count
    const fps = CANDIDATES / interval

    const out = join(dir, 'tiles')
    await mkdir(out, { recursive: true })

    await execFileAsync(
      ffmpegPath,
      [
        '-loglevel',
        'error',
        '-i',
        file,
        '-vf',
        `fps=${fps.toFixed(6)},scale=${TILE_WIDTH}:-2`,
        // Fixed quality, because the sharpness pick below compares file sizes
        // and only means anything if every candidate was encoded the same way.
        '-q:v',
        '4',
        join(out, '%04d.jpg'),
      ],
      { timeout: SAMPLE_TIMEOUT_MS },
    )

    const files = (await readdir(out)).filter((n) => n.endsWith('.jpg')).sort()
    if (files.length === 0) return null

    const picked = await pickSharpest(out, files)
    const tiles = await Promise.all(
      picked.map((i) => readFile(join(out, files[i]))),
    )

    const { width, height } = await sharp(tiles[0]).metadata()
    if (!width || !height) return null

    // Stacked, not tiled into a grid: one column means slicing is a single
    // percentage on one axis, and the sheet's width stays a tile's width
    // whatever the count turns out to be.
    const sheet = await sharp({
      create: {
        width,
        height: height * tiles.length,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .composite(tiles.map((input, i) => ({ input, left: 0, top: i * height })))
      .webp({ quality: SHEET_QUALITY })
      .toBuffer()

    const filename = storagePath.split('/').pop() ?? storagePath
    const stem = filename.replace(/\.[^.]+$/, '')
    // Beside the poster and the end frame, under the same prefix, so one
    // `thumbs/` sweep still finds everything a clip owns.
    const sheetPath = `${userId}/thumbs/${stem}-frames.webp`

    await createImageStorage().upload(sheetPath, sheet, {
      contentType: 'image/webp',
      upsert: true,
    })

    return {
      // `fps` emits its first frame at t=0 and one every 1/fps after it, so a
      // candidate's index is its timestamp.
      times: picked.map((i) => Number((i / fps).toFixed(3))),
      sheetPath,
      tileWidth: width,
      tileHeight: height,
    }
  } catch {
    return null
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

export interface ClipFrame {
  /** PNG bytes, base64, for `saveFileToLibrary` in the browser (#215). */
  base64: string
  width: number
  height: number
}

/**
 * One frame of a clip at full resolution, for import.
 *
 * `-ss` before `-i` so it is a seek rather than a decode-and-discard, and PNG
 * for parity with every other frame this app puts in the library.
 *
 * The clip is downloaded per call rather than held between them: `storage`
 * has no ranged read, the caller imports a handful of frames at most, and a
 * cache of temp files keyed by clip is a lifetime problem in exchange for a
 * second.
 */
export async function extractClipFrame({
  bytes,
  timeSeconds,
}: {
  bytes: Uint8Array
  timeSeconds: number
}): Promise<ClipFrame> {
  if (!ffmpegPath) throw new Error('ffmpeg is not available')

  let dir: string | null = null
  try {
    dir = await mkdtemp(join(tmpdir(), 'genzen-frame-'))
    const file = join(dir, `${randomUUID()}.mp4`)
    await writeFile(file, bytes)

    const { stdout: frame } = await execFileAsync(
      ffmpegPath,
      [
        '-loglevel',
        'error',
        '-ss',
        timeSeconds.toFixed(3),
        '-i',
        file,
        '-frames:v',
        '1',
        '-c:v',
        'png',
        '-f',
        'image2pipe',
        '-',
      ],
      {
        timeout: GRAB_TIMEOUT_MS,
        maxBuffer: 64 * 1024 * 1024,
        encoding: 'buffer',
      },
    )

    if (!frame.length)
      throw new Error('Could not read a frame at that position')

    const { width, height } = await sharp(frame).metadata()
    if (!width || !height) throw new Error('The frame decoded with no size')

    return { base64: frame.toString('base64'), width, height }
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
