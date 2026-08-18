import { AccountNav } from './_components/account-nav/account-nav'
import styles from './layout.module.css'

/* The settings area: a nav down the left, the chosen page beside it (#406).
 *
 * A layout rather than a component each page renders, so the nav is not
 * remounted on navigation and the active item does not flicker. Ported from
 * `~/repos/bootsy`'s `app/admin/layout.tsx`; the one thing not copied is its
 * `top: 56px`, which is the height of a global header bar genzen does not have
 * -- here the chrome is an icon rail down the side and the offset is the
 * shell's own padding. */
export default function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <AccountNav />
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
