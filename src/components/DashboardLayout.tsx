'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { ADPanel } from '@/features/ad/components/ADPanel'
import { ADContextProvider } from '@/features/ad/context/ad-context'
import { useADOpen } from '@/lib/use-ad-open'
import { cn } from '@/lib/utils'
import { StatusBar } from '@/features/status-bar'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isOpen: isADOpen } = useADOpen()

  // Pages with fixed sidebars manage their own AD push-in margins
  const isEditPage = pathname.startsWith('/dashboard/edit/')
  const isAiImagesPage = pathname === '/dashboard/ai-images'
  const hasOwnSidebar = isEditPage || isAiImagesPage

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
