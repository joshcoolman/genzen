'use client'

import styles from './empty-prompt.module.css'

/** Shown on a canvas with nothing on it. Not EmptyState: this one teaches the
 *  canvas's interaction model rather than reporting an empty list. */
export function EmptyPrompt() {
  return (
    <div className={styles.empty}>
      <p>Drop images here, paste from clipboard, or use the + button</p>
      <p className={styles.emptyHint}>
        Click to set paste target &middot; Scroll to zoom &middot; Space+drag to
        pan
      </p>
    </div>
  )
}
