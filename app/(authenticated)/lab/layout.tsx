import { LabNav } from './_components/lab-nav/lab-nav'
import styles from './layout.module.css'

/**
 * The lab: a nav down the left, the chosen experiment beside it (#424).
 *
 * Deliberately the same shape as `/account` — a layout rather than a component
 * each page renders, so the nav is not remounted on navigation and the active
 * item does not flicker. Its stylesheet is a copy of that one rather than a
 * shared module: the lab is meant to be deletable by deleting this folder, and
 * a stylesheet two sections import is a thread to unpick.
 */
export default function LabLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <LabNav />
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
