'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Menu } from 'lucide-react'
import { clsx } from 'clsx'
import styles from './mobile-nav.module.css'
import type { NavItem } from '#/lib/nav-items'
import { logout } from '#/features/auth/logout.action'
import { ConfirmDialog, Sheet, SheetContent, useConfirm } from '#/components'
import { navItems } from '#/lib/nav-items'

/** How far up a drag on the pill has to travel before it counts as a swipe. */
const SWIPE_PX = 16

/**
 * The phone's navigation (#753): a pill at the bottom that opens a sheet from
 * the bottom. It replaced a hamburger in the top-left corner, the one place a
 * thumb does not reach.
 *
 * **The pill sits above the bottom edge, never on it.** A swipe up from the
 * very edge is iOS's go-home gesture and the system always wins it, so the
 * thing you swipe has to be something visible a little higher up.
 *
 * Tap and swipe up both open it. The sheet holds the sections worth using on
 * a phone as tiles, then everything else as a list; `NavItem.mobile` says
 * which is which, and Edit is not on the phone at all.
 */
export function MobileNav({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const swipeFrom = useRef<number | null>(null)

  const primary = navItems.filter((item) => item.mobile === 'primary')
  const others = navItems.filter((item) => !item.mobile)

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

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const isActive = (item: NavItem) => {
    if (pathname.startsWith(item.href)) return true
    return item.matchPaths?.some((p) => pathname.startsWith(p)) ?? false
  }

  const current = navItems.find(isActive)
  const CurrentIcon = current?.icon ?? Menu

  return (
    <div className={clsx(styles.root, className)}>
      <button
        type="button"
        className={styles.pill}
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        onPointerDown={(e) => {
          swipeFrom.current = e.clientY
        }}
        onPointerMove={(e) => {
          if (swipeFrom.current === null) return
          if (swipeFrom.current - e.clientY > SWIPE_PX) {
            swipeFrom.current = null
            setOpen(true)
          }
        }}
        onPointerUp={() => {
          swipeFrom.current = null
        }}
        onPointerCancel={() => {
          swipeFrom.current = null
        }}
      >
        <span className={styles.grip} aria-hidden="true" />
        <span className={styles.pillLabel}>
          <CurrentIcon />
          {current?.label ?? 'Menu'}
        </span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className={styles.sheet}
          showCloseButton={false}
        >
          <span className={styles.handle} aria-hidden="true" />
          <nav className={styles.nav}>
            <div className={styles.tiles}>
              {primary.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={clsx(styles.tile, isActive(item) && styles.on)}
                >
                  <item.icon />
                  {item.label}
                </Link>
              ))}
            </div>
            <div className={styles.list}>
              {others.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={clsx(styles.row, isActive(item) && styles.on)}
                >
                  <item.icon />
                  {item.label}
                </Link>
              ))}
              <button
                type="button"
                className={styles.row}
                onClick={() => void askThenSignOut()}
              >
                <LogOut />
                Log out
              </button>
            </div>
          </nav>
          <ConfirmDialog {...dialogProps} />
        </SheetContent>
      </Sheet>
    </div>
  )
}
