'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from '../sidebar/sidebar'
import { MobileNav } from '../mobile-nav/mobile-nav'
import styles from './app-chrome.module.css'
import { cx } from '#/lib/utils'

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Pages with fixed sidebars manage their own right margin
  const isEditPage = pathname.startsWith('/edit/')
  const isImagesPage = pathname === '/images'
  const hasOwnSidebar = isEditPage || isImagesPage

  return (
    <div className={styles.shell}>
      {/* Desktop sidebar - collapsed on md+, always icons-only on sm */}
      <Sidebar className={styles.sidebar} />

      {/* Mobile nav trigger (hidden on edit pages) */}
      {!isEditPage && <MobileNav className={styles.mobileNav} />}

      <main className={cx(styles.main, hasOwnSidebar && styles.mainFlush)}>
        {children}
      </main>
    </div>
  )
}
