'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { clipFacts } from '../../../_components/clip-facts'
import styles from './clip-row.module.css'
import type { VideoRecord } from '../../../../video/_actions/generate-video.action'
import { MediaBox } from '#/components'
import { cx } from '#/lib/utils'

/** The tile edge. Paired with `--tile` in the stylesheet, which is what the
 *  add button matches: `MediaBox` is sized in px, not by its container. */
const TILE = 108

/**
 * The run, as a row of first frames you can drag into order.
 *
 * **It looks like a timeline and deliberately is not one.** No time ruler, no
 * proportional widths, no playhead running across it. Every tile is the same
 * size whatever the clip's length, because the question this page asks is about
 * arrangement, not pacing (#497). Proportional widths are cheap the day they
 * are wanted -- `duration_seconds` is already on the row -- and would be a
 * different page's answer.
 *
 * **A correctly ordered run is visible before you press play.** In a chain made
 * by Continue (#494) each clip starts on the frame the one before it ended on,
 * so the tiles visibly rhyme: a tile that does not resemble its left-hand
 * neighbour's ending is in the wrong place. That is why the tiles are first
 * frames rather than, say, the middle of each clip.
 *
 * Native HTML drag and drop, not pointer maths: a row of a dozen tiles that
 * only ever reorders is exactly what it is for, and the browser draws the drag
 * image itself.
 */
export function ClipRow({
  clips,
  onAdd,
  onRemove,
  onMove,
}: {
  clips: Array<VideoRecord>
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
          <MediaBox
            kind="video"
            src={`/img/${clip.id}`}
            size={TILE}
            alt={clipFacts(clip)}
          />
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
