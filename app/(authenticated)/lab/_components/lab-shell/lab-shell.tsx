'use client'

import { useEffect } from 'react'
import { LabNav } from '../lab-nav/lab-nav'
import styles from './lab-shell.module.css'
import { usePersistedState } from '#/lib/use-persisted-state'
import { cx } from '#/lib/utils'

const KEY = 'genzen:lab:nav-collapsed'

/**
 * The lab's two columns, and the one thing about them that is stateful.
 *
 * The layout was a server component until the rail could collapse. It has to be
 * a client component now because the state lives above both columns — the aside
 * narrows and the main widens together — but it is still rendered *from* the
 * layout, so the nav is not remounted on navigation and the active item does not
 * flicker.
 *
 * **Collapsed persists.** A rail you have to re-collapse on every visit is one
 * you stop collapsing. It is also the only state here: the lab pages own theirs.
 */
export function LabShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed, hydrated] = usePersistedState<boolean>(
    () => localStorage.getItem(KEY) === 'true',
    false,
  )

  // Gated on `hydrated` — see usePersistedState. Without it this writes the
  // fallback over the stored value on mount and the rail silently reopens on
  // every page load.
  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(KEY, String(collapsed))
  }, [collapsed, hydrated])

  return (
    <div className={cx(styles.shell, collapsed && styles.shellCollapsed)}>
      <aside
        className={cx(styles.sidebar, collapsed && styles.sidebarCollapsed)}
      >
        <LabNav
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
