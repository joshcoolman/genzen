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

import { navItems } from '#/lib/nav-items'
import { cx } from '#/lib/utils'

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname()

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
    <aside className={cx(styles.root, className)}>
      {/* Navigation */}
      <TooltipProvider delay={0}>
        <nav className={styles.nav}>
          {mainItems.map((item) => {
            const active = isActive(item)
            return (
              <div key={item.href}>
                {item.dividerBefore && <div className={styles.divider} />}
                <Tooltip>
                  <TooltipTrigger
                    render={<Link href={item.href} />}
                    className={cx(styles.item, active && styles.itemActive)}
                  >
                    <item.icon className={styles.icon} />
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              </div>
            )
          })}
          <div className={styles.divider} />
          {[accountItem].map((item) => (
            <Tooltip key={item.id}>
              <TooltipTrigger
                render={<Link href={item.href} />}
                className={cx(styles.item, isActive(item) && styles.itemActive)}
              >
                <item.icon className={styles.icon} />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
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
              className={styles.item}
            >
              <LogOut className={styles.icon} />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Log out
            </TooltipContent>
          </Tooltip>
          <ConfirmDialog {...dialogProps} />
        </nav>
      </TooltipProvider>
    </aside>
  )
}
