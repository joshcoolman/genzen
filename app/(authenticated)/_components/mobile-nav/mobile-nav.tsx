'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Menu } from 'lucide-react'
import { NavMore } from '../nav-more/nav-more'
import { logout } from '#/features/auth/logout.action'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Sheet,
  SheetContent,
  SheetTrigger,
} from '#/components'
import { navItems } from '#/lib/nav-items'
import { useNavVisibility } from '#/lib/use-nav-visibility'
import { cn } from '#/lib/utils'

export function MobileNav({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { isItemHidden, showMoreNav } = useNavVisibility()

  const accountItem = navItems.find((item) => item.id === 'account')!
  const settingsItem = navItems.find((item) => item.id === 'settings')!

  const mainItems = navItems.filter(
    (item) => item.id !== 'account' && item.id !== 'settings',
  )

  const visibleItems = mainItems.filter((item) => !isItemHidden(item.id))

  const hiddenItems = mainItems.filter((item) => isItemHidden(item.id))

  const handleSignOut = () => {
    void logout()
  }

  // Close sheet on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const isActive = (item: { href: string; matchPaths?: Array<string> }) => {
    if (pathname.startsWith(item.href)) return true
    return item.matchPaths?.some((p) => pathname.startsWith(p)) ?? false
  }

  return (
    <div className={cn('fixed left-4 top-4 z-50', className)}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="bg-card">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="flex w-64 flex-col bg-card p-0 top-0 h-screen"
        >
          {/* Nav items */}
          <nav className="space-y-1 p-4">
            {visibleItems.map((item) => {
              const active = isActive(item)
              return (
                <div key={item.href}>
                  {item.dividerBefore && (
                    <div className="my-2 border-t border-border" />
                  )}
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                      active
                        ? 'border-l-2 border-accent-brand bg-sidebar-hover text-foreground'
                        : 'text-muted-foreground hover:bg-sidebar-hover hover:text-foreground',
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </div>
              )
            })}
            {showMoreNav && (
              <NavMore variant="mobile" hiddenItems={hiddenItems} />
            )}
            <div className="my-2 border-t border-border" />
            {[settingsItem, accountItem].map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive(item)
                    ? 'border-l-2 border-accent-brand bg-sidebar-hover text-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-hover hover:text-foreground',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-hover hover:text-foreground transition-colors">
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Log out?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You'll need to sign in again to access your account.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSignOut}>
                    Log out
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  )
}
