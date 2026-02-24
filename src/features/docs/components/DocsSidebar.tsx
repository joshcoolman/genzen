import { useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { DocNavCategory } from '@/lib/docs/types'
import { cn } from '@/lib/utils'

interface DocsSidebarProps {
  categories: Array<DocNavCategory>
}

export function DocsSidebar({ categories }: DocsSidebarProps) {
  const location = useLocation()
  const currentSlug = location.pathname.replace(/^\/docs\/?/, '')

  return (
    <aside className="w-64 shrink-0 border-r border-border overflow-y-auto h-full">
      <div className="p-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Documentation
        </h2>
        <nav className="space-y-1">
          {categories.map((category) => (
            <CategorySection
              key={category.name}
              category={category}
              currentSlug={currentSlug}
            />
          ))}
        </nav>
      </div>
    </aside>
  )
}

function CategorySection({
  category,
  currentSlug,
}: {
  category: DocNavCategory
  currentSlug: string
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 w-full text-left text-sm font-medium text-muted-foreground hover:text-foreground py-1 transition-colors"
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
        {category.name}
      </button>
      {open && (
        <ul className="ml-4 space-y-0.5 mt-0.5">
          {category.items.map((item) => (
            <li key={item.slug}>
              <Link
                to={'/docs/$' as string}
                params={{ _splat: item.slug }}
                className={cn(
                  'block text-sm py-1 px-2 rounded transition-colors',
                  item.slug === currentSlug
                    ? 'text-accent-gold bg-accent/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/30',
                )}
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
