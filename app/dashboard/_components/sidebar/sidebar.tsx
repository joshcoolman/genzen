'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components'
import { useSidebarCollapsed } from '#/lib/use-sidebar-collapsed'

import { navItems } from '#/lib/nav-items'
import { useNavVisibility } from '#/lib/use-nav-visibility'
import { cn } from '#/lib/utils'

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname()
  const { isCollapsed } = useSidebarCollapsed()
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

  const isActive = (item: { href: string; matchPaths?: Array<string> }) => {
    if (item.href === '/dashboard') {
      return pathname === '/dashboard'
    }
    if (pathname.startsWith(item.href)) return true
    return item.matchPaths?.some((p) => pathname.startsWith(p)) ?? false
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen flex-col bg-sidebar transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-16 md:w-52',
        className,
      )}
    >
      {/* Navigation */}
      <TooltipProvider delayDuration={0}>
        <nav className="flex-1 space-y-1 p-4">
          {visibleItems.map((item) => {
            const active = isActive(item)
            return (
              <div key={item.href}>
                {item.dividerBefore && (
                  <div className="my-2 border-t border-border" />
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center rounded-md px-3 py-2 text-sm transition-colors',
                        'gap-3',
                        isCollapsed
                          ? 'justify-center'
                          : 'justify-center md:justify-start',
                        active
                          ? cn(
                              'bg-sidebar-selected text-sidebar-selected-text',
                              !isCollapsed &&
                                'md:border-l-2 md:border-accent-brand',
                            )
                          : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-hover-text',
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!isCollapsed && (
                        <span className="hidden flex-1 md:inline">
                          {item.label}
                        </span>
                      )}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className={cn('text-xs', !isCollapsed && 'md:hidden')}
                    sideOffset={8}
                  >
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              </div>
            )
          })}
          {showMoreNav && (
            <NavMore
              isCollapsed={isCollapsed}
              variant="sidebar"
              hiddenItems={hiddenItems}
            />
          )}
          <div className="my-2 border-t border-border" />
          {[settingsItem, accountItem].map((item) => (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center rounded-md px-3 py-2 text-sm transition-colors',
                    'gap-3',
                    isCollapsed
                      ? 'justify-center'
                      : 'justify-center md:justify-start',
                    isActive(item)
                      ? cn(
                          'bg-sidebar-selected text-sidebar-selected-text',
                          !isCollapsed &&
                            'md:border-l-2 md:border-accent-brand',
                        )
                      : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-hover-text',
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!isCollapsed && (
                    <span className="hidden flex-1 md:inline">
                      {item.label}
                    </span>
                  )}
                </Link>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className={cn('text-xs', !isCollapsed && 'md:hidden')}
                sideOffset={8}
              >
                {item.label}
              </TooltipContent>
            </Tooltip>
          ))}
          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <button
                    className={cn(
                      'flex w-full items-center rounded-md px-3 py-2 text-sm text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-hover-text transition-colors gap-3',
                      isCollapsed
                        ? 'justify-center'
                        : 'justify-center md:justify-start',
                    )}
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    {!isCollapsed && (
                      <span className="hidden md:inline">Log out</span>
                    )}
                  </button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className={cn('text-xs', !isCollapsed && 'md:hidden')}
                sideOffset={8}
              >
                Log out
              </TooltipContent>
            </Tooltip>
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
      </TooltipProvider>
    </aside>
  )
}
