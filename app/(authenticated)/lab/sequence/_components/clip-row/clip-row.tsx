'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { clipFacts } from '../../../_components/clip-facts'
import styles from './clip-row.module.css'
import type { VideoRecord } from '../../../../video/_actions/generate-video.action'
import { MediaBox } from '#/components'
import { imageUrl } from '#/lib/image-url'
import { cx } from '#/lib/utils'

/** The edge of one frame. Paired with `--tile` in the stylesheet, which is what
 *  the add button matches: `MediaBox` is sized in px, not by its container. */
const TILE = 108

/**
 * The run, as a row of clips you can drag into order -- each one showing the
 * frame it starts on and the frame it ends on.
 *
 * **It looks like a timeline and deliberately is not one.** No time ruler, no
 * proportional widths, no playhead running across it. Every tile is the same
 * size whatever the clip's length, because the question this page asks is about
 * arrangement, not pacing (#497). Proportional widths are cheap the day they
 * are wanted -- `duration_seconds` is already on the row -- and would be a
 * different page's answer.
 *
 * **Two frames per tile, because the cut is between them** (#512). A row of
 * first frames asked you to remember what the clip before ended on, which is
 * the one frame that was never on screen. With both, the ending of clip N sits
 * directly beside the beginning of clip N+1 -- the gap between two tiles *is*
 * the cut being judged, and no arrangement of a single frame per clip can put
 * those two pictures next to each other.
 *
 * That is also why the pair is drawn as one tile rather than as loose frames:
 * the two halves belong to a clip, the space between tiles belongs to a cut,
 * and the eye has to be able to tell which gap it is looking at.
 *
 * In a chain made by Continue (#494) each clip starts on the frame the one
 * before it ended on, so a correctly ordered run is visible before you press
 * play: across a seam, the two frames match.
 *
 * **Frame one is a `<video>`, the ending an `<img>`.** Not an oversight. A clip
 * whose poster never decoded still paints frame one through `MediaBox`'s seeked
 * media fragment, so that half can never be blank; `/img/[id]?v=end`
 * deliberately has no fallback, so the ending half is either the real last
 * frame or nothing. Both render the same picture at the same size, and the
 * asymmetry buys a row that degrades in the one direction that keeps working.
 *
 * Native HTML drag and drop, not pointer maths: a row of a dozen tiles that
 * only ever reorders is exactly what it is for, and the browser draws the drag
 * image itself.
 */
export function ClipRow({
  clips,
  playingIndex,
  onAdd,
  onRemove,
  onMove,
}: {
  clips: Array<VideoRecord>
  /** Where the player is in the run, so the row can say so (#512). */
  playingIndex: number | null
  onAdd: () => void
  onRemove: (id: string) => void
  onMove: (from: number, to: number) => void
}) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const drop = (to: number) => {
    if (draggingIndex !== null) onMove(draggingIndex, to)
    setDraggingIndex(null)
    setOverIndex(null)
  }

  return (
    <div className={styles.row}>
      {clips.map((clip, index) => (
        <div
          key={clip.id}
          className={cx(
            styles.tile,
            draggingIndex === index && styles.tileDragging,
            overIndex === index && draggingIndex !== index && styles.tileOver,
            playingIndex === index && styles.tilePlaying,
          )}
          draggable
          onDragStart={() => setDraggingIndex(index)}
          onDragEnd={() => {
            setDraggingIndex(null)
            setOverIndex(null)
          }}
          onDragOver={(e) => {
            // Without this the drop is refused and every drag snaps back.
            e.preventDefault()
            setOverIndex(index)
          }}
          onDrop={(e) => {
            e.preventDefault()
            drop(index)
          }}
          title={clipFacts(clip)}
        >
          {/* The position, not the clip's name: what you are checking while
              rearranging is where in the run this sits. */}
          <span className={styles.ordinal}>{index + 1}</span>
          <div className={styles.frames}>
            <MediaBox
              kind="video"
              src={`/img/${clip.id}`}
              size={TILE}
              alt={clipFacts(clip)}
            />
            {clip.has_end_frame ? (
              <img
                className={styles.endFrame}
                src={imageUrl(clip.id, 'end')}
                alt=""
                draggable={false}
              />
            ) : (
              /* A clip from before #512 that the backfill could not decode.
                 The slot is held rather than collapsed: a row of tiles at two
                 different widths reads as two kinds of clip, which is a
                 distinction that does not exist. */
              <div className={styles.endMissing} aria-hidden />
            )}
          </div>
          <button
            type="button"
            className={styles.remove}
            onClick={() => onRemove(clip.id)}
            aria-label="Remove from the run"
          >
            <X size={12} />
          </button>
        </div>
      ))}

      {/* Always last, so adding a clip appends to the end of the run and the
          control does not move as the row grows. */}
      <button type="button" className={styles.add} onClick={onAdd}>
        <Plus size={16} />
        <span className={styles.addLabel}>Add clips</span>
      </button>
    </div>
  )
}
