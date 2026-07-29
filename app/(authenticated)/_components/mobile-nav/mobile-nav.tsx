'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Menu } from 'lucide-react'
import { clsx } from 'clsx'
import styles from './mobile-nav.module.css'
import { logout } from '#/features/auth/logout.action'
import {
  Button,
  ConfirmDialog,
  Sheet,
  SheetContent,
  SheetTrigger,
  useConfirm,
} from '#/components'
import { navItems } from '#/lib/nav-items'

export function MobileNav({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
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

  // Close sheet on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const isActive = (item: { href: string; matchPaths?: Array<string> }) => {
    if (pathname.startsWith(item.href)) return true
    return item.matchPaths?.some((p) => pathname.startsWith(p)) ?? false
  }

  return (
    <div className={clsx(styles.root, className)}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="secondary" className={styles.trigger}>
              <Menu />
            </Button>
          }
        />
        <SheetContent side="left" className={styles.sheet}>
          {/* Nav items */}
          <nav className={styles.nav}>
            {mainItems.map((item) => {
              const active = isActive(item)
              return (
                <div key={item.href}>
                  {item.dividerBefore && <div className={styles.divider} />}
                  <Link
                    href={item.href}
                    className={clsx(styles.item, active && styles.itemActive)}
                  >
                    <item.icon />
                    {item.label}
                  </Link>
                </div>
              )
            })}
            <div className={styles.divider} />
            {[accountItem].map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={clsx(
                  styles.item,
                  isActive(item) && styles.itemActive,
                )}
              >
                <item.icon />
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              className={styles.item}
              onClick={() => void askThenSignOut()}
            >
              <LogOut />
              Log out
            </button>
            <ConfirmDialog {...dialogProps} />
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  )
}
