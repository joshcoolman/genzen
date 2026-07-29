'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from '../sidebar/sidebar'
import { MobileNav } from '../mobile-nav/mobile-nav'
import styles from './app-chrome.module.css'
import { cx } from '#/lib/utils'

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Images runs its own fixed generator sidebar, so it owns the right edge.
  const hasOwnSidebar = pathname === '/images'

  return (
    <div className={styles.shell}>
      {/* Desktop sidebar - collapsed on md+, always icons-only on sm */}
      <Sidebar className={styles.sidebar} />

      <MobileNav className={styles.mobileNav} />

      <main className={cx(styles.main, hasOwnSidebar && styles.mainFlush)}>
        {children}
      </main>
    </div>
  )
}
