'use client'

import styles from './clip-frames.module.css'
import type { VideoRecord } from '../../../video/_actions/generate-video.action'
import { MediaBox } from '#/components'
import { imageUrl } from '#/lib/image-url'

/** `ImageBox`'s own default mat under `contain`, repeated here because the
 *  ending frame is a plain `<img>` and has to match the box beside it. */
const DEFAULT_PAD = 10

/**
 * One clip as the frame it starts on and the frame it ends on, side by side.
 *
 * **Two frames because the cut is between them** (#512). A single first frame
 * asks you to remember what the clip before ended on, which is the one frame
 * that was never on screen. With both, the ending of clip N sits beside the
 * beginning of clip N+1, and in a chain made by Continue (#494) a correctly
 * ordered run shows it: across a seam, the two frames match.
 *
 * **Frame one is a `<video>`, the ending an `<img>`.** Not an oversight. A clip
 * whose poster never decoded still paints frame one through `MediaBox`'s seeked
 * media fragment, so that half can never be blank; `/img/[id]?v=end`
 * deliberately has no fallback, so the ending half is either the real last
 * frame or nothing. Both render at the same size, and the asymmetry buys a tile
 * that degrades in the one direction that keeps working.
 *
 * **Its own component because Sequence's run and the picker both draw it.** The
 * run had it since #512 and the picker showed a first frame only, which meant
 * the dialog you choose a clip in could not answer the question you were
 * choosing for. Two consumers, so it moved here beside `ClipPicker` rather than
 * being copied.
 */
export function ClipFrames({
  clip,
  size,
  alt,
  pad = DEFAULT_PAD,
}: {
  clip: VideoRecord
  /** The edge of one frame. A pair is twice this wide. */
  size: number
  alt: string
  /** The mat inside each frame, in px. Passed through to `MediaBox` and matched
   *  by the ending frame. */
  pad?: number
}) {
  const box = { width: size, height: size, padding: pad }

  return (
    <div className={styles.frames}>
      <MediaBox
        kind="video"
        src={`/img/${clip.id}`}
        alt={alt}
        size={size}
        fit="contain"
        pad={pad}
      />
      {clip.has_end_frame ? (
        <img
          className={styles.end}
          style={box}
          src={imageUrl(clip.id, 'end')}
          alt=""
          draggable={false}
        />
      ) : (
        /* A clip from before #512 that the backfill could not decode. The slot
           is held rather than collapsed: tiles at two different widths read as
           two kinds of clip, which is a distinction that does not exist. */
        <div className={styles.end} style={box} aria-hidden />
      )}
    </div>
  )
}
