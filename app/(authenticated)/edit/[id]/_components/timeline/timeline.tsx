'use client'

import { Fragment, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { formatClock, lengthOf, totalSeconds } from '../../cut'
import styles from './timeline.module.css'
import type { PlayableItem } from '../cut-player/cut-player'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { clipFacts, clipModel, clipName } from '#/features/video/clip-facts'
import { cx } from '#/lib/utils'

/** Pixels per second. Paired with `--pps` in the stylesheet. */
export const PX_PER_SECOND = 40

/** The shortest span a trim may leave. */
const MIN_SPAN = 0.2

/** Seek this far short of a moment when painting its frame: a seek to exactly
 *  `out` may be past the last decodable frame and paint nothing. */
const FRAME_NUDGE = 0.05

/**
 * The cut, as a strip you can arrange, trim and scrub (#726).
 *
 * **It is the timeline Director's row deliberately is not.** Tiles are as wide
 * as their kept span, a ruler above them is the run's clock, a playhead runs
 * across both, and each tile's two edges are handles that set its in and out
 * points. Reordering is Director's mechanism, copied: native drag and drop, a
 * slot that opens in the gaps, moved on `dragenter`.
 *
 * **A trim shows the frame it lands on.** Each tile's two ends are `<video>`
 * elements seeked to `in` and `out` by media fragment, the way `MediaBox`
 * paints a first frame -- so the picture updates when the handle is let go,
 * and the readout on the handle says the seconds while it moves. Seeking on
 * every pointer move would refetch a range per pixel.
 *
 * **The in handle keeps the tile's right edge still.** Trimming the head
 * shortens a clip from the left, but a flex tile shrinks from the right; a
 * margin the width of the trim holds the tile in place until the pointer is
 * released, and then the run closes up. Without it, dragging the left handle
 * rightwards moved the *other* edge, which is a strange thing to watch.
 */
export function Timeline({
  items,
  durations,
  playingIndex,
  time,
  onAdd,
  onRemove,
  onMove,
  onTrim,
  onPlayFrom,
  onSeek,
}: {
  items: Array<PlayableItem>
  /** The real length of each clip's file, where known, so the out handle
   *  stops at the end of the footage. */
  durations: ReadonlyMap<string, number>
  playingIndex: number | null
  /** Seconds on the run's clock, for the playhead. */
  time: number
  onAdd: () => void
  onRemove: (key: string) => void
  onMove: (from: number, to: number) => void
  onTrim: (key: string, span: { in: number; out: number }) => void
  /** Play from `offset` seconds into this clip's kept span. */
  onPlayFrom: (index: number, offset?: number) => void
  onSeek: (seconds: number) => void
}) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [overGap, setOverGap] = useState<number | null>(null)
  const dragging = draggingIndex !== null
  const content = useRef<HTMLDivElement>(null)

  const reset = () => {
    setDraggingIndex(null)
    setOverGap(null)
  }
  const drop = () => {
    if (draggingIndex !== null && overGap !== null) {
      onMove(draggingIndex, overGap > draggingIndex ? overGap - 1 : overGap)
    }
    reset()
  }

  const total = totalSeconds(items)
  const lifted = draggingIndex !== null ? items[draggingIndex] : null
  const slot = (
    <div
      className={styles.slot}
      style={{ width: lifted ? lengthOf(lifted) * PX_PER_SECOND : 0 }}
      aria-hidden
    />
  )

  /** Seconds under the pointer, measured from the strip's left edge. */
  const secondsAt = (clientX: number) => {
    const box = content.current?.getBoundingClientRect()
    if (!box) return 0
    // 16px is the content's own padding; see `.content`.
    return Math.max(0, (clientX - box.left - 16) / PX_PER_SECOND)
  }

  const scrub = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    onSeek(Math.min(secondsAt(e.clientX), total))
  }

  const ticks: Array<number> = []
  for (let s = 0; s <= Math.ceil(total) + 5; s++) ticks.push(s)

  return (
    <div className={styles.timeline}>
      <div
        ref={content}
        className={styles.content}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          drop()
        }}
      >
        <div
          className={styles.ruler}
          onPointerDown={scrub}
          onPointerMove={(e) => {
            if (e.buttons & 1) scrub(e)
          }}
        >
          {ticks.map((s) => (
            <Fragment key={s}>
              <span
                className={s % 5 === 0 ? styles.tickMajor : styles.tick}
                style={{ left: s * PX_PER_SECOND }}
              />
              {s % 5 === 0 && (
                <span
                  className={styles.tickLabel}
                  style={{ left: s * PX_PER_SECOND }}
                >
                  {formatClock(s).slice(0, -2)}
                </span>
              )}
            </Fragment>
          ))}
        </div>

        {items.length > 0 && (
          <div
            className={styles.playhead}
            style={{ left: 16 + Math.min(time, total) * PX_PER_SECOND }}
          />
        )}

        <div className={styles.track}>
          {items.map((item, index) => (
            <Fragment key={item.key}>
              {dragging && overGap === index && slot}
              <Tile
                item={item}
                index={index}
                duration={durations.get(item.clip.id)}
                lifted={draggingIndex === index}
                playing={playingIndex === index}
                onClick={(offset) => onPlayFrom(index, offset)}
                onRemove={() => onRemove(item.key)}
                onTrim={(span) => onTrim(item.key, span)}
                onDragStart={() => {
                  requestAnimationFrame(() => {
                    setDraggingIndex(index)
                    setOverGap(index)
                  })
                }}
                onDragEnd={reset}
                onDragEnter={(past) => setOverGap(past ? index + 1 : index)}
              />
            </Fragment>
          ))}
          {dragging && overGap === items.length && slot}
          <button
            type="button"
            className={styles.add}
            onClick={onAdd}
            onDragEnter={() => setOverGap(items.length)}
            onDragOver={(e) => e.preventDefault()}
          >
            <Plus size={16} />
            <span>Add clips</span>
          </button>
        </div>
      </div>
    </div>
  )
}

type Side = 'in' | 'out'

function Tile({
  item,
  index,
  duration,
  lifted,
  playing,
  onClick,
  onRemove,
  onTrim,
  onDragStart,
  onDragEnd,
  onDragEnter,
}: {
  item: PlayableItem
  index: number
  duration: number | undefined
  lifted: boolean
  playing: boolean
  onClick: (offset: number) => void
  onRemove: () => void
  onTrim: (span: { in: number; out: number }) => void
  onDragStart: () => void
  onDragEnd: () => void
  onDragEnter: (past: boolean) => void
}) {
  /** The span while a handle is held, or null. */
  const [draft, setDraft] = useState<{
    side: Side
    in: number
    out: number
  } | null>(null)
  const grab = useRef<{ x: number; in: number; out: number } | null>(null)

  const span = draft ?? item
  const width = lengthOf(span) * PX_PER_SECOND
  /* The out handle stops at the footage's end. Until the file's real length is
     known the row's requested length is the best guess, and the current out
     point is a floor on it: a clip cannot be shorter than what is kept. */
  const max = Math.max(duration ?? 0, item.out)

  const press = (side: Side) => (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    grab.current = { x: e.clientX, in: item.in, out: item.out }
    setDraft({ side, in: item.in, out: item.out })
  }
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = grab.current
    if (!start || !draft) return
    const delta = (e.clientX - start.x) / PX_PER_SECOND
    if (draft.side === 'in') {
      const next = Math.max(0, Math.min(start.in + delta, start.out - MIN_SPAN))
      setDraft({ ...draft, in: next })
    } else {
      const next = Math.min(
        max,
        Math.max(start.out + delta, start.in + MIN_SPAN),
      )
      setDraft({ ...draft, out: next })
    }
  }
  const release = () => {
    if (draft) onTrim({ in: draft.in, out: draft.out })
    grab.current = null
    setDraft(null)
  }

  const style: CSSProperties = {
    width,
    ...(draft?.side === 'in'
      ? { marginLeft: (draft.in - item.in) * PX_PER_SECOND }
      : {}),
  }

  return (
    <div
      className={cx(
        styles.tile,
        lifted && styles.tileLifted,
        playing && styles.tilePlaying,
      )}
      style={style}
      draggable={!draft}
      onClick={(e) => {
        const box = e.currentTarget.getBoundingClientRect()
        onClick((e.clientX - box.left) / PX_PER_SECOND)
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragEnter={(e) => {
        const box = e.currentTarget.getBoundingClientRect()
        onDragEnter(e.clientX > box.left + box.width / 2)
      }}
      onDragOver={(e) => e.preventDefault()}
      title={clipFacts(item.clip)}
    >
      <video
        className={styles.frame}
        src={`/img/${item.clip.id}#t=${Math.max(0.001, item.in)}`}
        preload="metadata"
        muted
        playsInline
      />
      <span className={styles.ordinal}>{index + 1}</span>
      <span className={styles.label}>
        {clipName(item.clip) ?? clipModel(item.clip)}
      </span>
      <span className={styles.facts}>
        {formatClock(span.in)} - {formatClock(span.out)}
        {' · '}
        {lengthOf(span).toFixed(1)}s
      </span>
      <video
        className={styles.frameEnd}
        src={`/img/${item.clip.id}#t=${Math.max(0.001, item.out - FRAME_NUDGE)}`}
        preload="metadata"
        muted
        playsInline
      />
      <button
        type="button"
        className={styles.remove}
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        aria-label="Remove from the cut"
        title="Remove from the cut"
      >
        <X size={12} />
      </button>
      {(['in', 'out'] as const).map((side) => (
        <div
          key={side}
          className={cx(
            side === 'in' ? styles.handleIn : styles.handleOut,
            draft?.side === side && styles.handleActive,
          )}
          role="slider"
          aria-label={side === 'in' ? 'In point' : 'Out point'}
          aria-valuenow={span[side]}
          aria-valuemin={side === 'in' ? 0 : span.in + MIN_SPAN}
          aria-valuemax={side === 'in' ? span.out - MIN_SPAN : max}
          /* Draggable itself, and cancelled: the handle's own dragstart is the
             one that fires, so the tile never lifts under a trim. */
          draggable
          onDragStart={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={press(side)}
          onPointerMove={move}
          onPointerUp={release}
          onPointerCancel={release}
        >
          {draft?.side === side && (
            <span
              className={styles.readout}
              style={side === 'in' ? { left: '100%' } : { right: '100%' }}
            >
              {formatClock(span[side])}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
