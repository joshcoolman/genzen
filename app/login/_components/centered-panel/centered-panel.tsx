import styles from './centered-panel.module.css'
import type { ReactNode } from 'react'

/** Login's whole visual frame: a full-height centred page with a fixed-width
 *  column in it. Route-local rather than a primitive -- the 24rem is this
 *  screen's decision, and a "centred panel" that hardcodes one width is not
 *  generic, it is this panel with a vaguer name. */
export function CenteredPanel({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.panel}>{children}</div>
    </div>
  )
}
