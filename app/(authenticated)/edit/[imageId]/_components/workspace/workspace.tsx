import styles from './workspace.module.css'
import type { ReactNode } from 'react'
import { cx } from '#/lib/utils'

export interface WorkspaceProps {
  /** How many panels are docked to the right: the generator, the AD, or both. */
  docked: 0 | 1 | 2
  children: ReactNode
}

export function Workspace({ docked, children }: WorkspaceProps) {
  return (
    <div
      className={cx(
        styles.root,
        docked === 1 && styles.docked1,
        docked === 2 && styles.docked2,
      )}
    >
      {children}
    </div>
  )
}
