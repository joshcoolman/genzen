'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import styles from './sidebar.module.css'
import { logout } from '#/features/auth/logout.action'
import {
  ConfirmDialog,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useConfirm,
} from '#/components'
import { useSidebarCollapsed } from '#/lib/use-sidebar-collapsed'

import { navItems } from '#/lib/nav-items'
import { cn } from '#/lib/utils'

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname()
  const { isCollapsed } = useSidebarCollapsed()

  const accountItem = navItems.find((item) => item.id === 'account')!

  const mainItems = navItems.filter((item) => item.id !== 'account')

  const { confirm, dialogProps } = useConfirm()

  async function askThenSignOut() {
    const ok = await confirm({
      title: 'Log out?',
      message: "You'll need to sign in again to access your account.",
      confirmLabel: 'Log out',
      destructive: false,
    })
    if (ok) void logout()
  }

  const isActive = (item: { href: string; matchPaths?: Array<string> }) => {
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
      <TooltipProvider delay={0}>
        <nav className="flex-1 space-y-1 p-4">
          {mainItems.map((item) => {
            const active = isActive(item)
            return (
              <div key={item.href}>
                {item.dividerBefore && (
                  <div className="my-2 border-t border-border" />
                )}
                <Tooltip>
                  <TooltipTrigger
                    render={<Link href={item.href} />}
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
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className={isCollapsed ? undefined : styles.hideOnDesktop}
                    sideOffset={8}
                  >
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              </div>
            )
          })}
          <div className="my-2 border-t border-border" />
          {[accountItem].map((item) => (
            <Tooltip key={item.id}>
              <TooltipTrigger
                render={<Link href={item.href} />}
                className={cn(
                  'flex items-center rounded-md px-3 py-2 text-sm transition-colors',
                  'gap-3',
                  isCollapsed
                    ? 'justify-center'
                    : 'justify-center md:justify-start',
                  isActive(item)
                    ? cn(
                        'bg-sidebar-selected text-sidebar-selected-text',
                        !isCollapsed && 'md:border-l-2 md:border-accent-brand',
                      )
                    : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-hover-text',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!isCollapsed && (
                  <span className="hidden flex-1 md:inline">{item.label}</span>
                )}
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className={isCollapsed ? undefined : styles.hideOnDesktop}
                sideOffset={8}
              >
                {item.label}
              </TooltipContent>
            </Tooltip>
          ))}
          <Tooltip>
            {/* One library now: the Radix AlertDialogTrigger that used to wrap
                this with `asChild` is gone, so TooltipTrigger renders the
                button directly and `useConfirm` opens the dialog from the
                handler instead of from a trigger. */}
            <TooltipTrigger
              render={<button type="button" />}
              onClick={() => void askThenSignOut()}
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
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className={isCollapsed ? undefined : styles.hideOnDesktop}
              sideOffset={8}
            >
              Log out
            </TooltipContent>
          </Tooltip>
          <ConfirmDialog {...dialogProps} />
        </nav>
      </TooltipProvider>
    </aside>
  )
}
