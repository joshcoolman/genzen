'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Ellipsis, LogOut, Menu } from 'lucide-react'
import { clsx } from 'clsx'
import styles from './mobile-nav.module.css'
import type { NavItem } from '#/lib/nav-items'
import { logout } from '#/features/auth/logout.action'
import {
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  useConfirm,
} from '#/components'
import { navItems } from '#/lib/nav-items'

/**
 * The phone's navigation: one round button in the bottom-right corner, the
 * thumb's home, with the Images/Video plus stacked above it. It replaced a
 * bottom-centre pill (#753) that was easy to forget was there, which in turn
 * replaced a top-left hamburger a thumb could not reach.
 *
 * The button opens a short menu of the sections actually used on a phone
 * (`NavItem.mobile === 'menu'`) and More. More opens the full sheet:
 * everything else as tiles and a list, and Log out. Edit is not on the phone
 * at all.
 */
export function MobileNav({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const menu = navItems.filter((item) => item.mobile === 'menu')
  const tiles = navItems.filter((item) => item.mobile === 'tile')
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

  return (
    <div className={clsx(styles.root, className)}>
      <DropdownMenu>
        <DropdownMenuTrigger className={styles.button} aria-label="Open menu">
          <Menu />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="end"
          sideOffset={8}
          className={styles.menu}
        >
          {menu.map((item) => (
            <DropdownMenuItem
              key={item.id}
              className={clsx(styles.menuItem, isActive(item) && styles.on)}
              onClick={() => router.push(item.href)}
            >
              <item.icon />
              {item.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            className={styles.menuItem}
            onClick={() => setOpen(true)}
          >
            <Ellipsis />
            More
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className={styles.sheet}
          showCloseButton={false}
        >
          <span className={styles.handle} aria-hidden="true" />
          <nav className={styles.nav}>
            <div className={styles.tiles}>
              {tiles.map((item) => (
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
