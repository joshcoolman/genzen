import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import ffmpegPath from 'ffmpeg-static'
import sharp from 'sharp'

const execFileAsync = promisify(execFile)

/**
 * Cutting several clips into one file, with ffmpeg (#515).
 *
 * The editor's whole claim is that Export produces a real file rather than a
 * playlist, so this is the part that has to be true. Everything the timeline UI
 * does -- ordering, in and out points, the crossfade length -- arrives here as
 * numbers and is applied by ffmpeg, not simulated.
 *
 * **This runs on the server, not in the browser.** #515 was written on 2026-08-28
 * and specifies ffmpeg.wasm; #499 put real ffmpeg in the app on the 29th, which
 * makes the client-side plan the more expensive way to do the same thing. The
 * bytes are in a private bucket the server can already read, the encode is
 * native, and nothing has to be downloaded into a tab to be cut.
 *
 * Two passes, deliberately. Every segment is first normalised on its own --
 * trimmed, scaled onto one canvas, given an audio track whether or not it had
 * one -- and only then joined. `xfade` and the concat demuxer both require
 * their inputs to already agree on size, frame rate, pixel format and stream
 * layout, and a single filter graph that did all of it at once would fail on
 * the first clip whose shape differed, which is most timelines worth making.
 */

/** How long ffmpeg gets for one segment, and for the join. */
const SEGMENT_TIMEOUT_MS = 120_000
const JOIN_TIMEOUT_MS = 300_000

/**
 * One frame rate for the output, because `xfade` will not cross two inputs
 * that disagree. 30 is what the lineup's models mostly emit and what an
 * exported clip is most likely to be watched at.
 */
const OUTPUT_FPS = 30

/** The shortest crossfade worth having; below this it reads as a cut anyway. */
export const MIN_TRANSITION_SECONDS = 0.1

/** A clip on the track, with the part of it the user kept. */
export interface TimelineSegment {
  /** A local file. Callers download from storage first -- ffmpeg needs to seek,
   *  and an mp4's moov atom may sit at the end of the file. */
  file: string
  inSeconds: number
  outSeconds: number
}

export interface StitchResult {
  /** What the finished file actually runs to, by construction rather than by
   *  probe: every segment is cut to exactly its in/out length, and each
   *  crossfade overlaps two of them by its own duration. */
  durationSeconds: number
  width: number
  height: number
}

function requireFfmpeg(): string {
  if (!ffmpegPath) {
    throw new Error('ffmpeg is unavailable, so a timeline cannot be exported')
  }
  return ffmpegPath
}

/**
 * Does this file carry an audio stream?
 *
 * ffmpeg names every stream it found on stderr while refusing to run without an
 * output, which is cheaper than decoding anything and needs no second binary --
 * `ffprobe` would be another native dependency and another pnpm `allowBuilds`
 * entry to learn one boolean (the same trade `extractVideoPoster` declined).
 *
 * It matters because the join has to be uniform: a filter graph mapping `0:a`
 * fails outright on a silent clip, and half the lineup's models emit one. Every
 * segment is given an audio track either way, so a Veo clip with sound and a
 * Kling clip without can sit on the same track.
 */
const AUDIO_STREAM = /Stream #\d+:\d+(\[[^\]]*\])?[^\n]*: Audio:/

async function hasAudio(file: string): Promise<boolean> {
  const ffmpeg = requireFfmpeg()
  // The stream list is on stderr whether the decode succeeded or not, and this
  // decode *does* succeed on a video-only file -- reading the exit code instead
  // of the output reports every silent clip as having audio, and the next
  // segment then fails on `Stream map '0:a:0' matches no streams`.
  try {
    const { stderr } = await execFileAsync(
      ffmpeg,
      ['-i', file, '-f', 'null', '-'],
      {
        timeout: SEGMENT_TIMEOUT_MS,
        maxBuffer: 1024 * 1024 * 8,
      },
    )
    return AUDIO_STREAM.test(stderr)
  } catch (err) {
    return AUDIO_STREAM.test((err as { stderr?: string }).stderr ?? '')
  }
}

/**
 * The pixel size of a clip, read off its first frame.
 *
 * Same route `extractVideoPoster` takes and for the same reason: sharp is
 * already a dependency and a decoded frame *is* the video rectangle, so there
 * is nothing a probe would add.
 */
async function frameSize(
  file: string,
  dir: string,
): Promise<{ width: number; height: number }> {
  const ffmpeg = requireFfmpeg()
  const out = join(dir, `${randomUUID()}.png`)
  await execFileAsync(
    ffmpeg,
    ['-loglevel', 'error', '-i', file, '-frames:v', '1', '-y', out],
    { timeout: SEGMENT_TIMEOUT_MS },
  )
  const meta = await sharp(await readFile(out)).metadata()
  if (!meta.width || !meta.height) {
    throw new Error('Could not read the size of that clip')
  }
  // Even dimensions: yuv420p subsamples chroma by two, and libx264 refuses an
  // odd width or height outright.
  return {
    width: meta.width - (meta.width % 2),
    height: meta.height - (meta.height % 2),
  }
}

/**
 * Trim one clip and force it onto the output's shape.
 *
 * `-ss` before `-i` seeks rather than filters, and `-t` rather than `-to` makes
 * the length exactly what was asked for -- which is what lets the crossfade
 * offsets be arithmetic instead of a probe of each intermediate file.
 *
 * A clip that is not the canvas shape is fitted inside it and padded, never
 * stretched: an editor that silently changed the aspect of a shot would be
 * doing something the user did not ask for and cannot see until export.
 */
async function normaliseSegment(
  segment: TimelineSegment,
  index: number,
  canvas: { width: number; height: number },
  dir: string,
): Promise<string> {
  const ffmpeg = requireFfmpeg()
  const out = join(dir, `segment-${index}.mp4`)
  const duration = segment.outSeconds - segment.inSeconds
  const { width, height } = canvas

  const video =
    `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,` +
    `setsar=1,fps=${OUTPUT_FPS},format=yuv420p[v]`

  // A silent track when the source has none, so every segment has the same
  // stream layout and `acrossfade` has something to work with on both sides.
  const sourceHasAudio = await hasAudio(segment.file)
  const audioInput = sourceHasAudio
    ? []
    : ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000']

  await execFileAsync(
    ffmpeg,
    [
      '-loglevel',
      'error',
      '-ss',
      String(segment.inSeconds),
      '-t',
      String(duration),
      '-i',
      segment.file,
      ...audioInput,
      '-filter_complex',
      video,
      '-map',
      '[v]',
      '-map',
      sourceHasAudio ? '0:a:0' : '1:a:0',
      '-t',
      String(duration),
      '-c:v',
      'libx264',
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
      '-y',
      out,
    ],
    { timeout: SEGMENT_TIMEOUT_MS },
  )
  return out
}

/**
 * The `xfade`/`acrossfade` chain for N segments.
 *
 * Each fade consumes `transition` seconds of both neighbours, so the running
 * length after k joins is `sum(lengths) - k * transition`, and the next fade
 * starts `transition` before the end of what has been built so far. Getting
 * that offset wrong is the classic way to end up with a black gap or a
 * transition that fires before the shot it belongs to.
 */
function fadeGraph(durations: Array<number>, transition: number): string {
  const steps: Array<string> = []
  let vLabel = '0:v'
  let aLabel = '0:a'
  let elapsed = durations[0]

  for (let i = 1; i < durations.length; i++) {
    const offset = elapsed - transition
    const v = `v${i}`
    const a = `a${i}`
    steps.push(
      `[${vLabel}][${i}:v]xfade=transition=fade:duration=${transition}:offset=${offset}[${v}]`,
      `[${aLabel}][${i}:a]acrossfade=d=${transition}[${a}]`,
    )
    vLabel = v
    aLabel = a
    elapsed = elapsed + durations[i] - transition
  }

  return steps.join(';')
}

/**
 * Cut the timeline into one mp4 at `outFile`.
 *
 * `transitionSeconds` of 0 is a hard cut between every clip. Anything smaller
 * than half the shortest segment is rejected rather than clamped: a crossfade
 * longer than the shot it is fading out of produces something the timeline did
 * not depict, and silently shortening the user's choice is worse than saying
 * the shot is too short for it.
 */
export async function stitchTimeline(
  segments: Array<TimelineSegment>,
  outFile: string,
  transitionSeconds: number,
): Promise<StitchResult> {
  const ffmpeg = requireFfmpeg()
  if (segments.length === 0) {
    throw new Error('There is nothing on the timeline to export')
  }

  const durations = segments.map((s) => s.outSeconds - s.inSeconds)
  if (durations.some((d) => d <= 0)) {
    throw new Error(
      'A clip on the timeline has no length between its in and out points',
    )
  }

  const transition =
    transitionSeconds >= MIN_TRANSITION_SECONDS ? transitionSeconds : 0
  if (transition > 0 && segments.length > 1) {
    const shortest = Math.min(...durations)
    if (transition >= shortest) {
      throw new Error(
        `A ${transition}s crossfade does not fit: the shortest clip on the timeline is ${shortest.toFixed(2)}s`,
      )
    }
  }

  const dir = outFile.slice(0, outFile.lastIndexOf('/'))
  const canvas = await frameSize(segments[0].file, dir)

  const files: Array<string> = []
  for (const [index, segment] of segments.entries()) {
    files.push(await normaliseSegment(segment, index, canvas, dir))
  }

  const inputs = files.flatMap((f) => ['-i', f])
  const joined = transition > 0 && files.length > 1

  if (files.length === 1) {
    // Nothing to join. The segment is already the output's shape, so this is a
    // copy rather than a second encode.
    await execFileAsync(
      ffmpeg,
      ['-loglevel', 'error', '-i', files[0], '-c', 'copy', '-y', outFile],
      { timeout: JOIN_TIMEOUT_MS },
    )
  } else if (joined) {
    const graph = fadeGraph(durations, transition)
    const last = files.length - 1
    await execFileAsync(
      ffmpeg,
      [
        '-loglevel',
        'error',
        ...inputs,
        '-filter_complex',
        graph,
        '-map',
        `[v${last}]`,
        '-map',
        `[a${last}]`,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '18',
        // Pinned, not inherited. Without it the filter chain settles on
        // yuv444p and libx264 picks High 4:4:4 Predictive, which QuickTime
        // and Safari will not decode -- an export that plays in the page
        // that made it and nowhere else.
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        '-y',
        outFile,
      ],
      { timeout: JOIN_TIMEOUT_MS },
    )
  } else {
    // A hard cut. Every segment already shares an encode, so this is a stream
    // copy through the concat filter's cheaper cousin -- no second generation
    // of quality loss on a timeline with no transitions.
    const graph =
      files.map((_, i) => `[${i}:v][${i}:a]`).join('') +
      `concat=n=${files.length}:v=1:a=1[v][a]`
    await execFileAsync(
      ffmpeg,
      [
        '-loglevel',
        'error',
        ...inputs,
        '-filter_complex',
        graph,
        '-map',
        '[v]',
        '-map',
        '[a]',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '18',
        // Pinned, not inherited. Without it the filter chain settles on
        // yuv444p and libx264 picks High 4:4:4 Predictive, which QuickTime
        // and Safari will not decode -- an export that plays in the page
        // that made it and nowhere else.
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        '-y',
        outFile,
      ],
      { timeout: JOIN_TIMEOUT_MS },
    )
  }

  const total = durations.reduce((a, b) => a + b, 0)
  return {
    durationSeconds: joined ? total - transition * (files.length - 1) : total,
    width: canvas.width,
    height: canvas.height,
  }
}
