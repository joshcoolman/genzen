import styles from './edit-list.module.css'
import type { ReactNode } from 'react'

export function EditList({ children }: { children: ReactNode }) {
  return <div className={styles.list}>{children}</div>
}
