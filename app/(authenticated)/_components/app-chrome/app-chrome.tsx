'use client'

import { Sidebar } from '../sidebar/sidebar'
import { MobileNav } from '../mobile-nav/mobile-nav'
import styles from './app-chrome.module.css'

/**
 * Every route padded the same, including Images.
 *
 * Images used to be flush on the right: the generator was `position: fixed` and
 * could float over the gallery, so the shell's padding was space the page had
 * to fight. With the pin gone the panel only ever pushes, and the exception was
 * left showing as thumbnails jammed against the panel while the left edge kept
 * its margin.
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      {/* Desktop sidebar - collapsed on md+, always icons-only on sm */}
      <Sidebar className={styles.sidebar} />

      <MobileNav className={styles.mobileNav} />

      <main className={styles.main}>{children}</main>
    </div>
  )
}
