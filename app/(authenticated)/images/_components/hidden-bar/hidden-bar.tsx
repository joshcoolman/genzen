'use client'

import { ChevronDown, EyeOff, ScanSearch } from 'lucide-react'
import { useState } from 'react'
import styles from './hidden-bar.module.css'
import type { SavedAiImage } from '#/features/ai-images/types'
import { cx } from '#/lib/utils'

interface HiddenBarProps {
  hidden: Array<SavedAiImage>
  imageUrls: Record<string, string>
  /** Clear every hidden row at once and dismiss the bar. */
  onShowAll: () => void
  /** One picture back, from the tray. */
  onUnhide: (id: string) => void
  focusCount: number | null
  onClearFocus: () => void
}

/**
 * What the grid is not showing you (#504).
 *
 * **At the top, and toned.** It was a quiet rule under the grid, which is the
 * one place a statement about missing pictures does not work: you reach it
 * after running out of things to look at, which is exactly when you have
 * stopped looking. A hidden set you forget about is the failure this bar
 * exists to prevent, so it sits above the wall and carries enough colour to
 * register without competing with the pictures.
 *
 * **Three things in one line, and they do not compete.** The count states the
 * situation. `Show` is the blunt undo -- every hidden row back, bar gone.
 * Clicking anywhere else opens the tray, which is the considered one: the
 * hidden pictures as thumbnails, each one click from coming back on its own.
 *
 * The tray is why hidden rows are never drawn among the visible ones. A toggle
 * that put them back in the grid while still calling them hidden was the first
 * shape and it read as broken -- "4 hidden" over four visible pictures. Here
 * they are somewhere else, plainly a holding area, and the grid stays true.
 */
export function HiddenBar({
  hidden,
  imageUrls,
  onShowAll,
  onUnhide,
  focusCount,
  onClearFocus,
}: HiddenBarProps) {
  const [open, setOpen] = useState(false)

  if (focusCount !== null) {
    // Focus is the louder statement and it replaces the count on purpose:
    // while a spotlight is on, hidden is not the reason anything is missing,
    // and two bars each explaining a different absence is one too many for a
    // state you are in for a minute. No tray -- nothing is being held.
    return (
      <div className={cx(styles.bar, styles.focus)}>
        <ScanSearch className={styles.icon} />
        <span className={styles.count}>
          Showing {focusCount} {focusCount === 1 ? 'image' : 'images'}
        </span>
        <button type="button" className={styles.action} onClick={onClearFocus}>
          Show all
        </button>
      </div>
    )
  }

  if (hidden.length === 0) return null

  return (
    <div className={styles.wrap}>
      {/* The row is the disclosure, so the whole width is the target and the
          chevron is a marker rather than the only way in. `Show` sits inside
          it and stops the click, being the one thing here that is not "let me
          look". */}
      <button
        type="button"
        className={cx(styles.bar, styles.barButton, open && styles.barOpen)}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <EyeOff className={styles.icon} />
        <span className={styles.count}>{hidden.length} hidden</span>
        <ChevronDown
          className={cx(styles.chevron, open && styles.chevronOpen)}
        />
        <span
          className={styles.action}
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation()
            onShowAll()
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return
            e.preventDefault()
            e.stopPropagation()
            onShowAll()
          }}
        >
          Show
        </span>
      </button>

      {open && (
        <div className={styles.tray}>
          {hidden.map((img) => (
            /* The thumbnail is the button. There is one verb here and it is
               not destructive, so a hover control over the picture would be a
               second target for the same act. */
            <button
              key={img.id}
              type="button"
              className={styles.thumb}
              title={`Show ${img.title}`}
              onClick={() => onUnhide(img.id)}
            >
              {imageUrls[img.id] ? (
                /* A plain `img`: these are 4rem thumbs of a URL the gallery
                   already resolved, and `Thumbnail` carries a whole overlay
                   and badge system the tray has no use for. */
                <img src={imageUrls[img.id]} alt={img.title} />
              ) : (
                <span className={styles.thumbEmpty} />
              )}
              <span className={styles.thumbHint}>Show</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
