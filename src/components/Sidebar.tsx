import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { LogOut, PanelLeft, PanelLeftClose } from 'lucide-react'
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
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAccountStatus } from '@/lib/account-status'
import { useAuth } from '@/lib/auth'
import { useSidebarCollapsed } from '@/lib/use-sidebar-collapsed'

import { NavMore } from '@/components/NavMore'
import { NavSettings } from '@/components/NavSettings'
import { navItems } from '@/lib/nav-items'
import { useNavVisibility } from '@/lib/use-nav-visibility'
import { cn } from '@/lib/utils'

export function Sidebar({ className }: { className?: string }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const accountStatus = useAccountStatus()
  const { isCollapsed, toggleCollapsed } = useSidebarCollapsed()
  const { isItemHidden, showMoreNav } = useNavVisibility()

  const accountItem = navItems.find((item) => item.id === 'account')!

  const mainItems = navItems.filter((item) => item.id !== 'account')

  const visibleItems = mainItems.filter(
    (item) =>
      (!item.activeOnly || accountStatus === 'active') &&
      !isItemHidden(item.id),
  )

  const hiddenItems = mainItems.filter(
    (item) =>
      (!item.activeOnly || accountStatus === 'active') && isItemHidden(item.id),
  )

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
        'fixed left-0 top-0 h-screen flex-col bg-sidebar transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-16 md:w-52',
        className,
      )}
    >
      {/* Navigation */}
      <TooltipProvider delayDuration={0}>
        <nav className="flex-1 space-y-1 p-4">
          {/* Toggle button - only visible on md+ screens */}
          <div className="mb-2 hidden md:flex justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleCollapsed}
                  className="rounded-md p-2 text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-hover-text transition-colors"
                  aria-label={
                    isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
                  }
                >
                  {isCollapsed ? (
                    <PanelLeft className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs" sideOffset={8}>
                {isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              </TooltipContent>
            </Tooltip>
          </div>
          {visibleItems.map((item) => {
            const active = isActive(item.href)
            return (
              <div key={item.href}>
                {item.dividerBefore && (
                  <div className="my-2 border-t border-border" />
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.href}
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to={accountItem.href}
                className={cn(
                  'flex items-center rounded-md px-3 py-2 text-sm transition-colors',
                  'gap-3',
                  isCollapsed
                    ? 'justify-center'
                    : 'justify-center md:justify-start',
                  isActive(accountItem.href)
                    ? cn(
                        'bg-sidebar-selected text-sidebar-selected-text',
                        !isCollapsed && 'md:border-l-2 md:border-accent-brand',
                      )
                    : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-hover-text',
                )}
              >
                <accountItem.icon className="h-4 w-4 shrink-0" />
                {!isCollapsed && (
                  <span className="hidden flex-1 md:inline">
                    {accountItem.label}
                  </span>
                )}
              </Link>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className={cn('text-xs', !isCollapsed && 'md:hidden')}
              sideOffset={8}
            >
              {accountItem.label}
            </TooltipContent>
          </Tooltip>
          <NavSettings isCollapsed={isCollapsed} variant="sidebar" />
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
