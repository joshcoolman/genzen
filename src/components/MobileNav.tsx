import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import {
  Film,
  Home,
  Image,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Home', href: '/dashboard', icon: Home },
  { label: 'Images', href: '/dashboard/images', icon: Image },
  { label: 'AI Images', href: '/dashboard/ai-images', icon: Sparkles },
  { label: 'AI Video', href: '/dashboard/video', icon: Film },
  { label: 'Profile', href: '/dashboard/profile', icon: User },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export function MobileNav({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/' })
  }

  // Close sheet on route change
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  const isActive = (href: string) => {
    if (href === '/dashboard') return location.pathname === '/dashboard'
    return location.pathname.startsWith(href)
  }

  return (
    <div className={cn('fixed left-4 top-[60px] z-50', className)}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="bg-card">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="flex w-64 flex-col bg-card p-0 top-[52px] h-[calc(100vh-52px)]"
        >
          {/* Nav items */}
          <nav className="space-y-1 p-4">
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
        </SheetContent>
      </Sheet>
    </div>
  )
}
