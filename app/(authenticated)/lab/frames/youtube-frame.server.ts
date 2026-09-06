import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import ffmpegPath from 'ffmpeg-static'
import sharp from 'sharp'

const execFileAsync = promisify(execFile)

/** Resolving asks YouTube for the stream list, which is a network round trip
 *  and occasionally a slow one. */
const RESOLVE_TIMEOUT_MS = 20_000

/** One seek and one frame. Longer than this means the range requests are not
 *  working and waiting will not fix it. */
const GRAB_TIMEOUT_MS = 30_000

/**
 * How long a resolved URL is reused.
 *
 * Google's URLs carry an expiry of about six hours. Half an hour is well inside
 * that and still means one `yt-dlp` call per video per sitting rather than one
 * per frame -- which is the difference between a grab that feels instant and
 * one that pauses for three seconds every time.
 */
const URL_TTL_MS = 30 * 60 * 1000

/**
 * The tallest stream worth pulling frames from.
 *
 * A frame is saved through the ordinary upload path, which refuses anything
 * over `MAX_FILE_SIZE` -- and a 4K PNG clears that on its own. 1080p is also
 * faster to seek and is more resolution than any reference use needs.
 */
const MAX_HEIGHT = 1080

/** Video-only formats first: frames need no audio, and asking for a muxed
 *  stream throws away the good video on anything YouTube serves as DASH. */
const FORMAT = `bv*[height<=${MAX_HEIGHT}]/b[height<=${MAX_HEIGHT}]/bv*/b`

const MISSING_YT_DLP =
  'yt-dlp is not installed. `brew install yt-dlp` and try again.'

/**
 * Resolved stream URLs, by video id.
 *
 * A module-level map, so it lives as long as the dev server and no longer.
 * Nothing here is worth a table: the URLs expire on their own, they are
 * worthless on any other machine, and the whole feature exists to leave nothing
 * behind.
 */
const resolved = new Map<string, { url: string; expires: number }>()

/**
 * The direct stream URL for a video, from `yt-dlp -g`.
 *
 * **This URL never goes to the browser.** Google binds it to the IP that asked
 * for it, so it works from the server that resolved it and nowhere else --
 * handing it to a tab would produce a 403 that looks like a bug in this page.
 */
async function streamUrl(videoId: string): Promise<string> {
  const hit = resolved.get(videoId)
  if (hit && hit.expires > Date.now()) return hit.url

  let stdout: string
  try {
    ;({ stdout } = await execFileAsync(
      'yt-dlp',
      [
        '-f',
        FORMAT,
        '-g',
        // A watch URL is often also a playlist URL, and resolving the playlist
        // is a long wait for the wrong answer.
        '--no-playlist',
        `https://www.youtube.com/watch?v=${videoId}`,
      ],
      { timeout: RESOLVE_TIMEOUT_MS },
    ))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(MISSING_YT_DLP)
    }
    // yt-dlp's own message is the useful one -- "Video unavailable", "Private
    // video", "Sign in to confirm your age" are all things only it can say.
    const stderr = (err as { stderr?: string }).stderr ?? ''
    const reason = stderr.split('\n').find((line) => line.includes('ERROR:'))
    throw new Error(
      reason?.replace(/^ERROR:\s*/, '').trim() ||
        'yt-dlp could not read that video',
    )
  }

  // With a video-only format this is one line. The fallbacks can print two --
  // video then audio -- and the first is always the video.
  const url = stdout
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)

  if (!url) throw new Error('yt-dlp returned no stream for that video')

  resolved.set(videoId, { url, expires: Date.now() + URL_TTL_MS })
  return url
}

export interface YouTubeFrame {
  /** PNG bytes, base64. It goes back to the browser to be saved through
   *  `saveFileToLibrary`, the one path into the library (#215). */
  base64: string
  width: number
  height: number
}

/**
 * The frame at `timeSeconds` of a YouTube video, decoded on the server.
 *
 * **The browser owns the time and the server owns the pixels.** A YouTube embed
 * is a cross-origin iframe: it will give up `getCurrentTime()` and never a
 * single pixel, so the canvas capture the rest of this page uses is impossible
 * against it. It does not need to be possible -- the embed and ffmpeg are
 * reading the same source, so seeking the stream to the position the player
 * reports lands on the frame that was on screen.
 *
 * **`-ss` before `-i` is the whole performance story.** There it is a seek, and
 * ffmpeg range-requests only the bytes around that timestamp; after `-i` it
 * decodes from the beginning and discards, which on a forty-minute video means
 * pulling the entire thing to get one still. Nothing is written to disk either
 * way.
 *
 * The caller has already checked that `videoId` is a video id.
 */
export async function youTubeFrame(
  videoId: string,
  timeSeconds: number,
): Promise<YouTubeFrame> {
  if (!ffmpegPath) throw new Error('ffmpeg is not available')

  const url = await streamUrl(videoId)

  let frame: Buffer
  try {
    ;({ stdout: frame } = await execFileAsync(
      ffmpegPath,
      [
        '-loglevel',
        'error',
        '-ss',
        timeSeconds.toFixed(3),
        '-i',
        url,
        '-frames:v',
        '1',
        // PNG for parity with the canvas capture beside it: both halves of this
        // page should put the same kind of file in the library.
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
    ))
  } catch {
    // A stale cached URL looks exactly like a broken one, and the fix for both
    // is to resolve again -- so drop it rather than leaving the next grab to
    // fail the same way.
    resolved.delete(videoId)
    throw new Error('Could not read a frame at that position')
  }

  if (!frame.length) throw new Error('Could not read a frame at that position')

  const { width, height } = await sharp(frame).metadata()
  if (!width || !height) throw new Error('The frame decoded with no size')

  return { base64: frame.toString('base64'), width, height }
}
