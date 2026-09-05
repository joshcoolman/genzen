import styles from './session-list.module.css'
import type { ReactNode } from 'react'

export function SessionList({ children }: { children: ReactNode }) {
  return <div className={styles.list}>{children}</div>
}
