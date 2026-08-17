import Link from 'next/link'
import { Palette } from 'lucide-react'
import styles from './settings-links.module.css'

/* Temporary, and deliberately so: /account/style has to be reachable before the
 * settings side-nav exists. #406 phase 1 replaces this whole component with
 * `account/layout.tsx` + the nav, and deletes it. */
export function SettingsLinks() {
  return (
    <div className={styles.card}>
      <Link href="/account/style" className={styles.link}>
        <Palette size={16} className={styles.icon} />
        <span className={styles.text}>
          <span className={styles.label}>Style</span>
          <span className={styles.hint}>
            Six colors that restyle the whole app
          </span>
        </span>
      </Link>
    </div>
  )
}
