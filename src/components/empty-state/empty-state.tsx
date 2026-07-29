import styles from './empty-state.module.css'
import type { ReactNode } from 'react'

/** The dashed panel a surface shows when it has nothing to show. Built from two
 *  call sites that were already byte-identical -- the gallery's empty grid and
 *  the edit route's "Image not found" -- so it carries no visual decision. */
export interface EmptyStateProps {
  title: string
  children?: ReactNode
}

export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className={styles.root}>
      <h3 className={styles.title}>{title}</h3>
      {children !== undefined && <p className={styles.body}>{children}</p>}
    </div>
  )
}
