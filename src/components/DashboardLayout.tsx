import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen overflow-x-hidden bg-background">
      {/* Desktop sidebar */}
      <Sidebar className="hidden lg:flex" />

      {/* Mobile nav trigger */}
      <MobileNav className="lg:hidden" />

      {/* Main content */}
      <main className="min-w-0 flex-1 p-6 lg:ml-64">{children}</main>
    </div>
  )
}
