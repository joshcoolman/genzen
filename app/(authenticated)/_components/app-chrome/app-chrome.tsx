'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from '../sidebar/sidebar'
import { MobileNav } from '../mobile-nav/mobile-nav'
import { StatusBar } from '../status-bar/status-bar'
import { ADPanel } from '../ad-panel/ad-panel'
import { ADContextProvider } from '../ad-context-provider/ad-context-provider'
import { useADOpen } from '#/lib/use-ad-open'
import { cn } from '#/lib/utils'

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isOpen: isADOpen } = useADOpen()

  // Pages with fixed sidebars manage their own AD push-in margins
  const isEditPage = pathname.startsWith('/edit/')
  const isImagesPage = pathname === '/images'
  const hasOwnSidebar = isEditPage || isImagesPage

  return (
    <ADContextProvider>
      <div className="flex min-h-screen overflow-x-hidden bg-background">
        {/* Desktop sidebar - collapsed on md+, always icons-only on sm */}
        <Sidebar className="hidden md:flex" />

        {/* Mobile nav trigger (hidden on edit pages) */}
        {!isEditPage && <MobileNav className="md:hidden" />}

        {/* Main content — edit page manages its own right margin for AD push-in */}
        <main
          className={cn(
            'min-w-0 flex-1 p-6 transition-all duration-300 md:ml-16',
            isADOpen && !hasOwnSidebar && 'md:mr-80',
            hasOwnSidebar && 'pr-0',
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
