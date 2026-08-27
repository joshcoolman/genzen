'use client'

import { EyeOff, ScanSearch } from 'lucide-react'
import styles from './visibility-strip.module.css'

interface VisibilityStripProps {
  hiddenCount: number
  onShowAll: () => void
  focusCount: number | null
  onClearFocus: () => void
}

/**
 * What the grid is not showing you, and the one way back (#504).
 *
 * **This is the feature, not the hiding.** Hiding an image is a two-line
 * change; hidden state you cannot see is a slower kind of lost, and it would
 * be trusted about twice before it burned someone. The strip is what makes a
 * hide safe enough to do casually and without a confirmation -- the cost of a
 * wrong click is reading one line and pressing one button.
 *
 * **Show unhides. It does not peek.** The first version revealed hidden rows
 * while still calling them hidden, and then needed a second verb to put the
 * state back -- three states for a feature whose whole appeal is that there is
 * nothing to understand. Show means the pictures are back and this line is
 * gone.
 *
 * Nothing renders when there is nothing hidden and no focus. A permanent
 * "0 hidden" would teach you to stop reading the line that matters.
 */
export function VisibilityStrip({
  hiddenCount,
  onShowAll,
  focusCount,
  onClearFocus,
}: VisibilityStripProps) {
  if (focusCount === null && hiddenCount === 0) return null

  // Focus is the louder statement and it suppresses the hidden count on
  // purpose: while a spotlight is on, hidden is not the reason anything is
  // missing, and two lines each explaining a different absence is one too many
  // for a state you are in for a minute.
  if (focusCount !== null) {
    return (
      <div className={styles.strip}>
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

  return (
    <div className={styles.strip}>
      <EyeOff className={styles.icon} />
      <span className={styles.count}>{hiddenCount} hidden</span>
      <button type="button" className={styles.action} onClick={onShowAll}>
        Show
      </button>
    </div>
  )
}
