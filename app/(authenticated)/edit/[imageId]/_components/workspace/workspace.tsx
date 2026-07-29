import styles from './workspace.module.css'
import type { ReactNode } from 'react'
import { cx } from '#/lib/utils'

export interface WorkspaceProps {
  /** Whether the generator is docked to the right. */
  docked: boolean
  children: ReactNode
}

export function Workspace({ docked, children }: WorkspaceProps) {
  return (
    <div className={cx(styles.root, docked && styles.docked)}>{children}</div>
  )
}
