import styles from './workspace.module.css'
import type { ReactNode } from 'react'
import { cx } from '#/lib/utils'

/**
 * The frame the gallery lives in. It exists because the content moves: an open
 * generator pushes it left.
 *
 * It also **owns the empty space under the grid** (#439). That space belonged
 * to the app chrome's `<main>`, which every route shares -- so a click in it
 * could not mean anything about this route's selection without teaching the
 * chrome about selections. `min-block-size: 100%` brings it inside the route
 * instead, and the click lands here.
 */
export function Workspace({
  pushed,
  onBackgroundClick,
  children,
}: {
  pushed: boolean
  /**
   * A click that landed on the frame itself and nothing in it. Compared by
   * identity rather than by what bubbles up: every card, button and caption in
   * here bubbles, and a handler that fired for those would clear the selection
   * on the very clicks that build it.
   */
  onBackgroundClick?: () => void
  children: ReactNode
}) {
  return (
    <div
      className={cx(styles.workspace, pushed && styles.pushed)}
      onClick={(e) => {
        if (e.target === e.currentTarget) onBackgroundClick?.()
      }}
    >
      <div className={styles.body}>{children}</div>
    </div>
  )
}
