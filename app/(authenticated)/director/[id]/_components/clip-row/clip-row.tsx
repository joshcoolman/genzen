'use client'

import { Fragment, useState } from 'react'
import { Loader, Pencil, Plus, ScrollText, Sparkles, X } from 'lucide-react'
import styles from './clip-row.module.css'
import type { VideoRecord } from '../../../../video/_actions/generate-video.action'
import { clipFacts, clipName } from '#/features/video/clip-facts'
import { cx } from '#/lib/utils'
import { ClipFrames } from '#/components'

/** The edge of one frame. Paired with `--tile` in the stylesheet, which is what
 *  the add button and the open slot match: a `MediaBox` is sized in px, not by
 *  its container. */
const TILE = 108

/** A clip the run is holding a place for, which FAL has not finished yet. */
const pending = (clip: VideoRecord) => clip.status !== 'completed'

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
 * is a real position between two clips, and it means the same thing whichever
 * direction you approached from.
 *
 * **The run opens a slot where the clip will land**, rather than lighting an
 * edge. This was refused once, and the reason was sound: shuffling tiles under
 * the pointer moves the drop target away from the pointer, and the row
 * oscillates as the two chase each other. Two things fix that, and both are
 * load-bearing:
 *
 * - **The width is conserved.** The lifted tile leaves the flow as the slot
 *   opens, so a clip is *moved* rather than inserted and the run's total width
 *   never changes. Inserting a slot reflows everything to its right -- across a
 *   wrap, onto different lines -- while you are trying to aim at it.
 * - **The slot moves on `dragenter`, not on `dragover`.** `dragover` fires
 *   continuously, so the slot would reopen from wherever the tiles had just
 *   shuffled to, which is the oscillation. Entering a tile is a discrete event
 *   and gives the hysteresis for free: the slot holds until the pointer is
 *   genuinely over a different clip.
 *
 * Native HTML drag and drop, not pointer maths: tiles that only ever reorder
 * are exactly what it is for, and the browser draws the drag image itself.
 *
 * **A pencil names the clip** (#657) -- the run is where an order becomes
 * "intro", "scene two", and the name it gets here is the name it has on the
 * Video wall, because it is the clip's own `title`.
 *
 * **A tap on a tile plays the run from that clip** (#655) -- the row is the
 * transport, which is why there is no longer a bar of buttons under the player.
 * Click and drag need no disambiguating: a browser does not fire `click` after
 * a completed drag, so there is no movement threshold and no timer here.
 *
 * **A chat's row is the same row, locked** (#670). The clips are the answers,
 * in the order they were asked, and the run is the conversation: nothing is
 * added, dragged, removed or regenerated here, and the model and the lengths
 * are fixed out of reach. What survives is watching the answer be built,
 * tapping a clip to play from it, and Script, which only reads.
 */
export function ClipRow({
  clips,
  mode = 'run',
  playingIndex,
  onAdd,
  onAddGen,
  onScript,
  onRemove,
  onMove,
  onPlayFrom,
  onRename,
}: {
  clips: Array<VideoRecord>
  /** A chat's row loses Add clips, Add gen, drag, the pencil and Remove
   *  (#670): all you can do in a chat is chat. */
  mode?: 'run' | 'chat'
  /** Where the player is in the run, so the row can say so (#512). */
  playingIndex: number | null
  onAdd: () => void
  /** Open the dialog that makes the next clip (#660). */
  onAddGen: () => void
  /** Show the run's prompts in one box, to copy out. */
  onScript: () => void
  onRemove: (id: string) => void
  onMove: (from: number, to: number) => void
  /** Play the run from this clip's first frame (#655). */
  onPlayFrom: (index: number) => void
  /** Open the naming dialog for this clip (#657). */
  onRename: (clip: VideoRecord) => void
}) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  /** The slot the clip would land in: 0 is before the first tile, `length` is
   *  after the last. A position between clips, not a tile. */
  const [overGap, setOverGap] = useState<number | null>(null)

  const dragging = draggingIndex !== null
  const editable = mode === 'run'

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

  /* The open slot, the same footprint as a tile so the run's rhythm is
     unbroken: two frames wide, plus the seam between them and the tile's own
     border. */
  const slot = <div className={styles.slot} aria-hidden />

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
        <Fragment key={clip.id}>
          {dragging && overGap === index && slot}
          <div
            className={cx(
              styles.tile,
              draggingIndex === index && styles.tileLifted,
              playingIndex === index && styles.tilePlaying,
              pending(clip) && styles.tilePending,
            )}
            /* A clip still being made cannot be dragged or played: there is
               nothing behind `/img/[id]` yet, and a run rearranged around a
               picture nobody has seen is an arrangement judged blind. It keeps
               its place in the row, because the press that asked for it was a
               press on this position. */
            draggable={editable && !pending(clip)}
            onClick={() => {
              if (!pending(clip)) onPlayFrom(index)
            }}
            onDragStart={() => {
              /* Deferred a frame, and that is the whole reason the tile can be
                 taken out of the flow at all. The browser's drag image is a
                 snapshot of the element taken as `dragstart` is dispatched, so
                 hiding it in this handler means dragging an invisible clip. */
              requestAnimationFrame(() => {
                setDraggingIndex(index)
                // Where it already is, so the run opens its slot in place
                // rather than jumping to wherever the pointer first crosses a
                // tile.
                setOverGap(index)
              })
            }}
            onDragEnd={reset}
            onDragEnter={(e) => {
              const box = e.currentTarget.getBoundingClientRect()
              const past = e.clientX > box.left + box.width / 2
              setOverGap(past ? index + 1 : index)
            }}
            onDragOver={(e) => e.preventDefault()}
            title={clipFacts(clip)}
          >
            {/* The position, not the clip's name: what you are checking while
                rearranging is where in the run this sits. */}
            <span className={styles.ordinal}>{index + 1}</span>
            {pending(clip) ? (
              <div className={styles.making}>
                <Loader size={14} />
                <span>Making this</span>
              </div>
            ) : (
              <ClipFrames clip={clip} size={TILE} alt={clipFacts(clip)} />
            )}
            {/* Both corner buttons stop the click: the tile behind them plays
                the run, and neither naming a clip nor dropping one is also a
                request to watch it. */}
            {editable && !pending(clip) && (
              <button
                type="button"
                className={styles.rename}
                onClick={(e) => {
                  e.stopPropagation()
                  onRename(clip)
                }}
                aria-label="Edit this clip"
                title="Edit this clip"
              >
                <Pencil size={12} />
              </button>
            )}
            {editable && (
              <button
                type="button"
                className={styles.remove}
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(clip.id)
                }}
                aria-label="Remove from the run"
              >
                <X size={12} />
              </button>
            )}
            {/* In the corner opposite the ordinal, and out of the flow: a name
                that took its own line would make named tiles taller than
                unnamed ones and the row ragged. Absent until there is one, so
                nothing is printed on a clip still called after its model. */}
            {clipName(clip) ? (
              <span className={styles.name}>{clipName(clip)}</span>
            ) : null}
          </div>
        </Fragment>
      ))}

      {dragging && overGap === clips.length && slot}

      {/* Always last, so adding a clip appends to the end of the run and the
          controls do not move as the run grows. Dragging over either means the
          end of the run, which is the one slot no tile can express.

          **Two buttons, and neither is the primary** (#660). One picks from
          what you have, the other makes something new; an empty run offers
          both, because a run can just as well start from a prompt as from the
          library. They are told apart by icon rather than by label -- they are
          adjacent, both say "add", and one of them spends money. */}
      {editable && (
        <>
          <button
            type="button"
            className={styles.add}
            onClick={onAdd}
            onDragEnter={() => setOverGap(clips.length)}
            onDragOver={(e) => e.preventDefault()}
          >
            <Plus size={16} />
            <span className={styles.addLabel}>Add clips</span>
          </button>

          <button
            type="button"
            className={cx(styles.add, styles.addGen)}
            onClick={onAddGen}
            onDragEnter={() => setOverGap(clips.length)}
            onDragOver={(e) => e.preventDefault()}
          >
            <Sparkles size={16} />
            <span className={styles.addLabel}>Add gen</span>
          </button>
        </>
      )}

      {/* Reads the run rather than adding to it, but it sits with the two adds
          because it is the third thing you do from the end of a row. Offered
          only once there is a prompt to read. */}
      {clips.length > 0 && (
        <button
          type="button"
          className={cx(styles.add, styles.script)}
          onClick={onScript}
          onDragEnter={() => setOverGap(clips.length)}
          onDragOver={(e) => e.preventDefault()}
        >
          <ScrollText size={16} />
          <span className={styles.addLabel}>Script</span>
        </button>
      )}
    </div>
  )
}
