'use client'

import { Check } from 'lucide-react'
import styles from './clip-frame-grid.module.css'
import { cx } from '#/lib/utils'

/** Two timestamps are the same tile within this much. The grid's own numbers
 *  are rounded to a millisecond, and a stamp read back out of jsonb should not
 *  miss its tile over the last digit. */
const SAME_TIME = 0.05

/** Which tiles a set of already-cut timestamps lands on. */
export function markedFrameIndexes(
  times: Array<number>,
  markedTimes: Array<number>,
): Set<number> {
  const marked = new Set<number>()
  times.forEach((time, index) => {
    if (markedTimes.some((t) => Math.abs(t - time) < SAME_TIME)) {
      marked.add(index)
    }
  })
  return marked
}

function timeLabel(seconds: number): string {
  const whole = Math.floor(seconds)
  const m = Math.floor(whole / 60)
  const s = whole % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * A clip's sampled frames as selectable tiles (#647, #665).
 *
 * **One picture, not twenty-eight.** The tiles are a single sprite sheet from
 * `/img/[id]?v=frames`, each cell slicing it with `background-position`.
 * Twenty-eight `<img>` elements would be twenty-eight requests every open, for
 * pictures that only exist together -- and the browser caches the one.
 *
 * **Presentational, and it fetches nothing.** The sheet and the timestamps come
 * from a server action the video route owns, and `src/components/` may not
 * import from `app/`; the caller loads them and hands them down. That is also
 * what lets two callers mean different things by the same tile: Video's Grab
 * frames marks an imported tile and locks it, because importing it twice would
 * put one picture in the library twice, while Director's reference picker marks
 * it and leaves it selectable, because the row that already exists is exactly
 * what it wants to reuse (`lockMarked`).
 */
export function ClipFrameGrid({
  sheetUrl,
  times,
  tileWidth,
  tileHeight,
  selected,
  marked,
  lockMarked = false,
  busy = false,
  onToggle,
  className,
}: {
  sheetUrl: string
  times: Array<number>
  tileWidth: number
  tileHeight: number
  /** Indexes into `times`. */
  selected: Set<number>
  /** Indexes already held in the library as stills. */
  marked?: Set<number>
  /** Whether a marked tile is out of bounds rather than merely noted. */
  lockMarked?: boolean
  busy?: boolean
  onToggle: (index: number) => void
  className?: string
}) {
  const count = times.length

  return (
    <div className={cx(styles.grid, className)}>
      {times.map((time, index) => {
        const already = marked?.has(index) ?? false
        const locked = already && lockMarked
        const on = selected.has(index)
        return (
          <button
            key={time}
            type="button"
            className={cx(
              styles.tile,
              on && styles.tileOn,
              locked && styles.tileDone,
            )}
            disabled={locked || busy}
            aria-pressed={on}
            onClick={() => onToggle(index)}
          >
            <span
              className={styles.frame}
              style={{
                aspectRatio: `${tileWidth} / ${tileHeight}`,
                backgroundImage: `url(${sheetUrl})`,
                backgroundSize: `100% ${count * 100}%`,
                /* A single column of `count` tiles: the nth is n/(count-1) of
                   the way down the track the background can travel. */
                backgroundPosition:
                  count > 1 ? `0 ${(index / (count - 1)) * 100}%` : '0 0',
              }}
            />
            <span className={styles.time}>
              {already ? <Check size={12} /> : null}
              {timeLabel(time)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
