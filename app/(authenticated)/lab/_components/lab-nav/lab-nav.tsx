'use client'

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './lab-nav.module.css'
import { cx } from '#/lib/utils'

/* Module-local rather than an entry in `src/lib/nav-items.ts`, for the same
 * reason the account nav is: that file is the app's own navigation, and putting
 * these there would light two rails at once and put experiments in the mobile
 * bar. Only `/lab` appears in the icon rail. */
const SECTIONS = [
  { href: '/lab/enhance', label: 'Enhance' },
  { href: '/lab/describe', label: 'Describe' },
  { href: '/lab/variations', label: 'Variations' },
  { href: '/lab/frames', label: 'Frames' },
  { href: '/lab/sequence', label: 'Sequence' },
  { href: '/lab/endpoint-explorer', label: 'Endpoints' },
]

export function LabNav({
  collapsed,
  onToggle,
}: {
  /** Desktop only -- the mobile nav is a horizontal strip with nothing to
   *  collapse, so the toggle is hidden there rather than conditionally
   *  rendered: the same markup at both sizes is one less thing to reason
   *  about. */
  collapsed: boolean
  onToggle: () => void
}) {
  const pathname = usePathname()

  return (
    <nav className={cx(styles.nav, collapsed && styles.navCollapsed)}>
      <div className={styles.head}>
        <span className={styles.eyebrow}>Lab</span>
        <button
          type="button"
          onClick={onToggle}
          className={styles.toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand lab nav' : 'Collapse lab nav'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? (
            <PanelLeftOpen size={16} />
          ) : (
            <PanelLeftClose size={16} />
          )}
        </button>
      </div>
      {SECTIONS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cx(styles.link, active && styles.linkActive)}
            title={collapsed ? label : undefined}
          >
            {/* The first letter is not an icon, and is not pretending to be
                one. Experiments with no visual identity would each need an
                invented glyph that has to be learned -- an initial is already
                the name, truncated. */}
            <span className={styles.linkInitial} aria-hidden="true">
              {label[0]}
            </span>
            <span className={styles.linkLabel}>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
