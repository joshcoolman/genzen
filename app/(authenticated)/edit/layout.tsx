import styles from './layout.module.css'
import type { ReactNode } from 'react'

export default function Layout({ children }: { children: ReactNode }) {
  return <div className={styles.root}>{children}</div>
}
