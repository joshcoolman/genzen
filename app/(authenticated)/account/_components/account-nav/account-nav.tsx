'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './account-nav.module.css'

import { accountNavItems } from '#/lib/section-nav-items'

export function AccountNav() {
  const pathname = usePathname()

  return (
    <nav className={styles.nav}>
      <span className={styles.eyebrow}>Account</span>
      {accountNavItems.map(({ href, label }) => {
        /* Overview is matched exactly, the rest by prefix. A `startsWith` on
         * `/account` would light Overview on every page in the section, since
         * every href here begins with it. */
        const active =
          href === '/account'
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`)

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`${styles.link} ${active ? styles.linkActive : ''}`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
