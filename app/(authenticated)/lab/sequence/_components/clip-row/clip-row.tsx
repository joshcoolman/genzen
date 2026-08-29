'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { ClipFrames } from '../../../_components/clip-frames/clip-frames'
import { clipFacts } from '../../../_components/clip-facts'
import styles from './clip-row.module.css'
import type { VideoRecord } from '../../../../video/_actions/generate-video.action'
import { cx } from '#/lib/utils'

/** The edge of one frame. Paired with `--tile` in the stylesheet, which is what
 *  the add button matches: a `MediaBox` is sized in px, not by its container. */
const TILE = 108

/**
 * The run, as clips you can drag into order -- each one showing the frame it
 * starts on and the frame it ends on (`ClipFrames`).
 *
 * **It looks like a timeline and deliberately is not one.** No time ruler, no
 * proportional widths, no playhead running across it. Every tile is the same
 * size whatever the clip's length, because the question this page asks is about
 * arrangement, not pacing (#497). Proportional widths are cheap the day they
 * are wanted -- `duration_seconds` is already on the row -- and would be a
 * different page's answer.
 *
 * **It wraps, and it used to scroll.** The original said a run is a line and a
 * second row of it would read as two runs. That is true of the picture and
 * false of the tool: past three clips the rest of the run was off-screen, so
 * arranging it meant scrolling to find the tile, scrolling to find where it
 * goes, and never seeing both at once -- which is the entire job. A run that is
 * all visible in three lines beats a line you cannot see.
 *
 * **Dropping happens in the gaps, not on the tiles.** A tile-targeted drop
 * cannot say which side of the target you meant, and the old one resolved that
 * by splicing at the target's pre-removal index: dragging rightwards landed
 * *after* the target and dragging leftwards landed *before* it, from the same
 * gesture, with no way to reach the end of the run at all. The insertion point
 * is a real position between two clips, it is drawn where it will land, and it
 * means the same thing whichever direction you approached from.
 *
 * Native HTML drag and drop, not pointer maths: tiles that only ever reorder
 * are exactly what it is for, and the browser draws the drag image itself.
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
  /** The slot the clip would land in: 0 is before the first tile, `length` is
   *  after the last. A position between clips, not a tile. */
  const [overGap, setOverGap] = useState<number | null>(null)

  const reset = () => {
    setDraggingIndex(null)
    setOverGap(null)
  }

  const drop = () => {
    if (draggingIndex !== null && overGap !== null) {
      // The gap is measured before the clip is lifted out, so every slot to its
      // right shifts down one once it is gone.
      onMove(draggingIndex, overGap > draggingIndex ? overGap - 1 : overGap)
    }
    reset()
  }

  return (
    <div
      className={styles.row}
      onDragOver={(e) => {
        // Without this the drop is refused and every drag snaps back. On the
        // row rather than only the tiles so the gaps themselves accept it.
        e.preventDefault()
      }}
      onDrop={(e) => {
        e.preventDefault()
        drop()
      }}
    >
      {clips.map((clip, index) => (
        <div
          key={clip.id}
          className={cx(
            styles.tile,
            draggingIndex === index && styles.tileDragging,
            overGap === index && styles.gapBefore,
            overGap === clips.length &&
              index === clips.length - 1 &&
              styles.gapAfter,
            playingIndex === index && styles.tilePlaying,
          )}
          draggable
          onDragStart={() => setDraggingIndex(index)}
          onDragEnd={reset}
          onDragOver={(e) => {
            e.preventDefault()
            const box = e.currentTarget.getBoundingClientRect()
            const past = e.clientX > box.left + box.width / 2
            setOverGap(past ? index + 1 : index)
          }}
          title={clipFacts(clip)}
        >
          {/* The position, not the clip's name: what you are checking while
              rearranging is where in the run this sits. */}
          <span className={styles.ordinal}>{index + 1}</span>
          <ClipFrames clip={clip} size={TILE} alt={clipFacts(clip)} />
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
          control does not move as the run grows. Dragging over it means the
          end of the run, which is the one slot no tile can express. */}
      <button
        type="button"
        className={styles.add}
        onClick={onAdd}
        onDragOver={(e) => {
          e.preventDefault()
          setOverGap(clips.length)
        }}
      >
        <Plus size={16} />
        <span className={styles.addLabel}>Add clips</span>
      </button>
    </div>
  )
}
