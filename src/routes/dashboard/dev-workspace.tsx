import { useEffect, useRef } from 'react'
import {
  Link,
  Outlet,
  createFileRoute,
  useLocation,
} from '@tanstack/react-router'
import {
  Boxes,
  Expand,
  FlaskConical,
  LayoutGrid,
  MessageSquare,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useSidebarCollapsed } from '@/lib/use-sidebar-collapsed'
import { cn } from '@/lib/utils'

interface DevNavItem {
  id: string
  label: string
  href: string
  icon: LucideIcon
}

const DEV_NAV_ITEMS: Array<DevNavItem> = [
  {
    id: 'outpaint',
    label: 'Outpaint',
    href: '/dashboard/dev-workspace/outpaint',
    icon: Expand,
  },
  {
    id: 'prompt-studio',
    label: 'Prompt Studio',
    href: '/dashboard/dev-workspace/prompt-studio',
    icon: MessageSquare,
  },
  {
    id: 'models',
    label: 'Models',
    href: '/dashboard/dev-workspace/models',
    icon: Boxes,
  },
  {
    id: 'model-selector',
    label: 'Model Selector',
    href: '/dashboard/dev-workspace/model-selector',
    icon: FlaskConical,
  },
  {
    id: 'multi-model',
    label: 'Multi-Model',
    href: '/dashboard/dev-workspace/multi-model',
    icon: LayoutGrid,
  },
]

export const Route = createFileRoute('/dashboard/dev-workspace')({
  component: DevWorkspaceLayout,
})

function DevWorkspaceLayout() {
  const location = useLocation()
  const { isCollapsed, setIsCollapsed } = useSidebarCollapsed()
  const savedCollapsed = useRef(isCollapsed)

  useEffect(() => {
    setIsCollapsed(true)
    return () => setIsCollapsed(savedCollapsed.current)
  }, [setIsCollapsed])

  return (
    <div className="flex gap-6 min-h-full">
      {/* Secondary left nav */}
      <nav className="w-44 shrink-0 border-r border-border pr-4">
        <p className="mb-3 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Dev Workspace
        </p>
        <div className="space-y-0.5">
          {DEV_NAV_ITEMS.map((item) => {
            const active = location.pathname === item.href
            return (
              <Link
                key={item.id}
                to={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                  active
                    ? 'bg-sidebar-selected text-sidebar-selected-text'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Experiment content */}
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
