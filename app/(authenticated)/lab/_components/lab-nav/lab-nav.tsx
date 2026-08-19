'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './lab-nav.module.css'

/* Module-local rather than an entry in `src/lib/nav-items.ts`, for the same
 * reason the account nav is: that file is the app's own navigation, and putting
 * these there would light two rails at once and put experiments in the mobile
 * bar. Only `/lab` appears in the icon rail. */
const SECTIONS = [
  { href: '/lab/enhance', label: 'Enhance' },
  { href: '/lab/describe', label: 'Describe' },
  { href: '/lab/variations', label: 'Variations' },
  { href: '/lab/frames', label: 'Frames' },
]

export function LabNav() {
  const pathname = usePathname()

  return (
    <nav className={styles.nav}>
      <span className={styles.eyebrow}>Lab</span>
      {SECTIONS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
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
