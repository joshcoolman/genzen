import styles from './workspace.module.css'
import type { ReactNode } from 'react'
import { cx } from '#/lib/utils'

/**
 * The frame the gallery lives in. It exists because the content moves: a
 * pinned generator pushes it left, an unpinned one floats over it.
 */
export function Workspace({
  pushed,
  children,
}: {
  pushed: boolean
  children: ReactNode
}) {
  return (
    <div className={cx(styles.workspace, pushed && styles.pushed)}>
      <div className={styles.body}>{children}</div>
    </div>
  )
}
