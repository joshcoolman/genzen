'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ChevronLeft, Ellipsis, LogOut, Menu } from 'lucide-react'
import { clsx } from 'clsx'
import styles from './mobile-nav.module.css'
import type { NavItem } from '#/lib/nav-items'
import { logout } from '#/features/auth/logout.action'
import {
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  useConfirm,
} from '#/components'
import { navItems } from '#/lib/nav-items'

/**
 * The phone's navigation: one round button in the bottom-right corner, the
 * thumb's home, with the Images/Video plus stacked above it. It replaced a
 * bottom-centre pill and sheet (#753) that was easy to forget was there,
 * which in turn replaced a top-left hamburger a thumb could not reach.
 *
 * The button opens a short menu of the sections actually used on a phone
 * (`NavItem.mobile === 'menu'`) and More, which flies out to the left with
 * everything else and Log out -- the same list, one level down, rather than a
 * different surface. Edit is not on the phone at all.
 */
export function MobileNav({ className }: { className?: string }) {
  const pathname = usePathname()
  const router = useRouter()

  const menu = navItems.filter((item) => item.mobile === 'menu')
  const more = navItems.filter((item) => !item.mobile)

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

  const isActive = (item: NavItem) => {
    if (pathname.startsWith(item.href)) return true
    return item.matchPaths?.some((p) => pathname.startsWith(p)) ?? false
  }

  const row = (item: NavItem) => (
    <DropdownMenuItem
      key={item.id}
      className={clsx(
        styles.item,
        isActive(item) && styles.on,
        item.dividerBefore && styles.divided,
      )}
      onClick={() => router.push(item.href)}
    >
      <item.icon />
      {item.label}
    </DropdownMenuItem>
  )

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
          {menu.map(row)}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className={clsx(styles.item, more.some(isActive) && styles.on)}
            >
              <Ellipsis />
              More
              <ChevronLeft className={styles.flyoutMark} />
            </DropdownMenuSubTrigger>
            <DropdownMenuContent
              side="left"
              align="end"
              sideOffset={4}
              className={styles.menu}
            >
              {more.map(row)}
              <DropdownMenuItem
                className={clsx(styles.item, styles.divided)}
                onClick={() => void askThenSignOut()}
              >
                <LogOut />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
