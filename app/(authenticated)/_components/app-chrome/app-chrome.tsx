'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from '../sidebar/sidebar'
import { MobileNav } from '../mobile-nav/mobile-nav'
import { StatusBar } from '../status-bar/status-bar'
import { ADPanel } from '../ad-panel/ad-panel'
import { ADContextProvider } from '../ad-context-provider/ad-context-provider'
import styles from './app-chrome.module.css'
import { useADOpen } from '#/lib/use-ad-open'
import { cx } from '#/lib/utils'

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isOpen: isADOpen } = useADOpen()

  // Pages with fixed sidebars manage their own AD push-in margins
  const isEditPage = pathname.startsWith('/edit/')
  const isImagesPage = pathname === '/images'
  const hasOwnSidebar = isEditPage || isImagesPage

  return (
    <ADContextProvider>
      <div className={styles.shell}>
        {/* Desktop sidebar - collapsed on md+, always icons-only on sm */}
        <Sidebar className={styles.sidebar} />

        {/* Mobile nav trigger (hidden on edit pages) */}
        {!isEditPage && <MobileNav className={styles.mobileNav} />}

        {/* Main content — edit page manages its own right margin for AD push-in */}
        <main
          className={cx(
            styles.main,
            isADOpen && !hasOwnSidebar && styles.mainPushed,
            hasOwnSidebar && styles.mainFlush,
          )}
        >
          {children}
        </main>

        {/* AD panel */}
        <ADPanel />

        {/* Universal toolbar */}
        <StatusBar />
      </div>
    </ADContextProvider>
  )
}
