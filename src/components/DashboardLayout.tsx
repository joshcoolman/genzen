import { useLocation } from '@tanstack/react-router'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { useIsMobile } from '@/lib/hooks/use-is-mobile'
import { ADPanel } from '@/features/ad/components/ADPanel'
import { ADContextProvider } from '@/features/ad/context/ad-context'
import { PromptSheet } from '@/features/prompts/components/PromptSheet'
import { usePromptSheet } from '@/features/prompts/hooks/use-prompt-sheet'
import { useADOpen } from '@/lib/use-ad-open'
import { cn } from '@/lib/utils'
import { StatusBar } from '@/features/status-bar'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { isOpen: isADOpen } = useADOpen()
  const promptSheet = usePromptSheet()

  // Hide mobile nav on edit pages for focused editing experience
  const isEditPage = location.pathname.startsWith('/dashboard/edit/')

  return (
    <ADContextProvider>
      <div className="flex min-h-screen overflow-x-hidden bg-background">
        {/* Desktop sidebar - collapsed on md+, always icons-only on sm */}
        <Sidebar className="hidden md:flex" />

        {/* Mobile nav trigger (hidden on edit pages) */}
        {!isEditPage && <MobileNav className="md:hidden" />}

        {/* Main content */}
        <main
          className={cn(
            'min-w-0 flex-1 p-6 transition-all duration-300 md:ml-16',
            isADOpen && 'md:mr-80',
          )}
        >
          {children}
        </main>

        {/* AD panel */}
        <ADPanel />

        {/* Universal toolbar */}
        <StatusBar onOpenPrompts={promptSheet.open} />

        {/* Prompt library bottom sheet */}
        <PromptSheet
          isOpen={promptSheet.isOpen}
          onClose={promptSheet.close}
          prompts={promptSheet.prompts}
          loading={promptSheet.loading}
          onAdd={promptSheet.addPrompt}
          onDelete={promptSheet.removePrompt}
          onRestore={promptSheet.restore}
          hasAllDefaults={promptSheet.hasAllDefaults}
        />
      </div>
    </ADContextProvider>
  )
}
