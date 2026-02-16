import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-52px)] bg-background">
      {/* Desktop sidebar */}
      <Sidebar className="hidden lg:flex" />

      {/* Mobile nav trigger */}
      <MobileNav className="lg:hidden" />

      {/* Main content */}
      <main className="flex-1 p-6 lg:ml-64">{children}</main>
    </div>
  )
}
