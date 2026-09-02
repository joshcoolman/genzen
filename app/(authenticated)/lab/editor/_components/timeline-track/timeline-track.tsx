'use client'

import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { trimmedLength } from '../../use-view'
import styles from './timeline-track.module.css'
import type { TrackClip } from '../../use-view'
import { imageUrl } from '#/lib/image-url'
import { cx } from '#/lib/utils'

/** Below this a clip is a sliver you cannot click, so short trims stop
 *  shrinking and the track stops being exactly to scale. Said out loud in the
 *  UI rather than hidden, because a ruler that silently lies is worse than one
 *  that admits where it stops. */
const MIN_SHARE = 0.06

/**
 * The cut, to scale.
 *
 * **Widths are proportional to trimmed length, which is the difference between
 * this and Sequence's row.** That row deliberately gives every clip the same
 * tile, because the question there is arrangement. Here the question is pacing
 * -- whether a two-second shot is holding long enough next to a six-second one
 * -- and that is unanswerable from tiles of equal size. `ClipRow`'s own note
 * says proportional widths "would be a different page's answer"; this is that
 * page.
 *
 * **Reordering is buttons, not drag.** Sequence solved drag properly and it
 * took a slot-opening, width-conserving implementation to stop the row
 * oscillating under the pointer. Two arrows on the selected clip are
 * unambiguous, reachable from the keyboard, and honest about what they do. If
 * this page earns its place, inheriting Sequence's drag is the obvious next
 * move rather than a second attempt at it.
 */
export function TimelineTrack({
  track,
  selectedKey,
  onSelect,
  onRemove,
  onMove,
  onAdd,
}: {
  track: Array<TrackClip>
  selectedKey: string | null
  onSelect: (key: string) => void
  onRemove: (key: string) => void
  onMove: (key: string, delta: -1 | 1) => void
  onAdd: () => void
}) {
  const total = track.reduce((sum, t) => sum + trimmedLength(t), 0)

  return (
    <div className={styles.track}>
      {track.map((t, index) => {
        const length = trimmedLength(t)
        const share = total > 0 ? length / total : 1 / Math.max(1, track.length)
        const selected = t.key === selectedKey
        return (
          <div
            key={t.key}
            className={cx(styles.clip, selected && styles.clipSelected)}
            style={{ flexGrow: Math.max(share, MIN_SHARE) }}
          >
            <button
              type="button"
              className={styles.face}
              onClick={() => onSelect(t.key)}
              // The poster, not the clip: a track of ten `<video>` elements is
              // ten range requests into 20-30MB files to show ten thumbnails.
              style={{
                backgroundImage: `url(${imageUrl(t.clip.id, 'thumb')})`,
              }}
            >
              <span className={styles.meta}>
                <span className={styles.name}>{t.clip.title}</span>
                <span className={styles.length}>
                  {t.duration == null ? '…' : `${length.toFixed(2)}s`}
                </span>
              </span>
            </button>

            {selected && (
              <div className={styles.controls}>
                <button
                  type="button"
                  className={styles.control}
                  disabled={index === 0}
                  onClick={() => onMove(t.key, -1)}
                  aria-label="Move earlier"
                >
                  <ChevronLeft className={styles.controlIcon} />
                </button>
                <button
                  type="button"
                  className={styles.control}
                  onClick={() => onRemove(t.key)}
                  aria-label="Remove from the timeline"
                >
                  <X className={styles.controlIcon} />
                </button>
                <button
                  type="button"
                  className={styles.control}
                  disabled={index === track.length - 1}
                  onClick={() => onMove(t.key, 1)}
                  aria-label="Move later"
                >
                  <ChevronRight className={styles.controlIcon} />
                </button>
              </div>
            )}
          </div>
        )
      })}

      <button
        type="button"
        className={styles.add}
        onClick={onAdd}
        aria-label="Add a clip to the timeline"
      >
        <Plus className={styles.addIcon} />
      </button>
    </div>
  )
}
