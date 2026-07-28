import styles from './stat-badge.module.css'
import type { ReactNode } from 'react'

/** One number worth looking at: an icon, a small uppercase label, and the
 *  value in full-size foreground text. Deliberately not a card -- it carries no
 *  surface of its own, so it sits inside whatever is already there. */
export interface StatBadgeProps {
  icon: ReactNode
  label: string
  value: string
  title?: string
}

export function StatBadge({ icon, label, value, title }: StatBadgeProps) {
  return (
    <div className={styles.badge} title={title}>
      <div className={styles.icon}>{icon}</div>
      <div className={styles.body}>
        <p className={styles.label}>{label}</p>
        <p className={styles.value}>{value}</p>
      </div>
    </div>
  )
}
