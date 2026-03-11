import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { useSidebarCollapsed } from '@/lib/use-sidebar-collapsed'
import { cn } from '@/lib/utils'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebarCollapsed()

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-background">
      {/* Desktop sidebar - collapsed on md+, always icons-only on sm */}
      <Sidebar className="hidden md:flex" />

      {/* Mobile nav trigger */}
      <MobileNav className="md:hidden" />

      {/* Main content */}
      <main
        className={cn(
          'min-w-0 flex-1 p-6 transition-all duration-300',
          isCollapsed ? 'md:ml-16' : 'md:ml-52'
        )}
      >
        {children}
      </main>
    </div>
  )
}
