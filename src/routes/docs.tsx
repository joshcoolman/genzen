import { useEffect, useState } from 'react'
import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { DocsSidebar } from '@/features/docs/components/DocsSidebar'
import { getDocNavCategories } from '@/lib/docs/loadDocs.server'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/docs')({
  loader: async () => {
    const categories = await getDocNavCategories()
    return { categories }
  },
  component: DocsLayout,
})

function DocsLayout() {
  const { categories } = Route.useLoaderData()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  // Close mobile menu when navigating to a new doc
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-[calc(100vh-49px)]">
      {/* Sidebar: always visible on md+, full-screen toggle on mobile */}
      <div
        className={cn(
          'md:block md:w-auto',
          mobileMenuOpen
            ? 'block w-full absolute inset-0 top-[49px] z-10 bg-background'
            : 'hidden',
        )}
      >
        <DocsSidebar categories={categories} />
      </div>
      {/* Content: always visible on md+, hidden when mobile menu is open */}
      <div
        className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden',
          mobileMenuOpen ? 'hidden md:block' : 'block',
        )}
      >
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex items-center gap-1.5 px-4 py-3 text-sm text-muted-foreground hover:text-foreground border-b border-border w-full md:hidden"
        >
          <ArrowLeft className="w-4 h-4" />
          Menu
        </button>
        <Outlet />
      </div>
    </div>
  )
}
