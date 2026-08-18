'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './account-nav.module.css'

/* A module-local list rather than an entry in `src/lib/nav-items.ts`: that file
 * is the app's own navigation, and these are pages *about* the app that only
 * this layout renders. Adding them there would put them in the icon rail and
 * the mobile bar too. */
const SECTIONS = [
  { href: '/account', label: 'Overview' },
  { href: '/account/style', label: 'Style' },
  { href: '/account/shortcuts', label: 'Shortcuts' },
]

export function AccountNav() {
  const pathname = usePathname()

  return (
    <nav className={styles.nav}>
      <span className={styles.eyebrow}>Account</span>
      {SECTIONS.map(({ href, label }) => {
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
