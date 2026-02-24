import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { Home, Image, LogOut, Settings, Sparkles, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

const navItems: Array<NavItem> = [
  { label: 'Home', href: '/dashboard', icon: Home },
  { label: 'Images', href: '/dashboard/images', icon: Image },
  { label: 'AI Images', href: '/dashboard/ai-images', icon: Sparkles },
  { label: 'Profile', href: '/dashboard/profile', icon: User },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export function Sidebar({ className }: { className?: string }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/' })
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return location.pathname === '/dashboard'
    }
    return location.pathname.startsWith(href)
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-[52px] h-[calc(100vh-52px)] w-64 flex-col border-r border-border bg-card',
        className,
      )}
    >
      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'border-l-2 border-accent-gold bg-sidebar-hover text-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-hover hover:text-foreground',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-hover hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </nav>
    </aside>
  )
}
