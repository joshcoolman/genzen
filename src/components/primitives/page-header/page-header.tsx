import styles from './page-header.module.css'
import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  description?: string
  /** Sits opposite the title. For a stat, an action, anything one thing wide. */
  aside?: ReactNode
}

export function PageHeader({ title, description, aside }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {aside}
    </header>
  )
}
