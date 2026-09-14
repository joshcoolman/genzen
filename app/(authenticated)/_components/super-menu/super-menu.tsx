'use client'

import { Dialog } from '@base-ui/react/dialog'
import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  FlaskConical,
  Frame,
  Grid2X2,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import styles from './super-menu.module.css'
import { navItems } from '#/lib/nav-items'
import { accountNavItems, labNavItems } from '#/lib/section-nav-items'
import { setKeyboardCaptured } from '#/lib/keyboard-capture'

const descriptions: Record<string, string> = {
  images: 'Generate, collect and compare images',
  video: 'Bring your images and ideas to life',
  director: 'Build a story, one scene at a time',
  explore: 'Browse images and find inspiration',
  activity: 'Review runs, timing and costs',
  trash: 'Restore or remove discarded work',
}
const createItems = navItems.filter((item) =>
  ['images', 'video', 'director'].includes(item.id),
)
const workspaceItems = navItems.filter((item) =>
  ['explore', 'activity', 'trash'].includes(item.id),
)

export function SuperMenu() {
  const pathname = usePathname()
  const [openedPath, setOpenedPath] = useState<string | null>(null)
  const open = openedPath === pathname

  // Forget an open menu on history navigation as well as link activation.
  if (openedPath !== null && openedPath !== pathname) setOpenedPath(null)

  useEffect(() => {
    setKeyboardCaptured(open)
    return () => setKeyboardCaptured(false)
  }, [open])

  const current = (href: string) =>
    pathname === href ||
    (href !== '/account' && pathname.startsWith(`${href}/`))
      ? ('page' as const)
      : undefined

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => setOpenedPath(next ? pathname : null)}
    >
      <Dialog.Trigger className={styles.trigger} aria-label="Open app menu">
        <Grid2X2 aria-hidden="true" />
        <span>
          Menu <ChevronDown aria-hidden="true" />
        </span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Viewport className={styles.viewport}>
          <Dialog.Popup className={styles.popup}>
            <header className={styles.header}>
              <div>
                <span className={styles.brand}>
                  genzen<span> / </span>your creative workspace
                </span>
                <Dialog.Title className={styles.title}>
                  A place for every idea.
                </Dialog.Title>
                <Dialog.Description className={styles.subtitle}>
                  Make something new, pick up your work, or try an experiment.
                </Dialog.Description>
              </div>
              <Dialog.Close
                className={styles.close}
                aria-label="Close app menu"
              >
                <X aria-hidden="true" />
                <kbd>esc</kbd>
              </Dialog.Close>
            </header>
            <nav
              aria-label="All app destinations"
              onClick={(event) => {
                if (
                  (event.target as HTMLElement).closest('a') &&
                  !event.metaKey &&
                  !event.ctrlKey &&
                  !event.shiftKey &&
                  !event.altKey
                )
                  setOpenedPath(null)
              }}
            >
              <div className={styles.columns}>
                <section className={styles.section}>
                  <h3>Create</h3>
                  <p>From the first spark to the final cut.</p>
                  {createItems.map(({ href, label, icon: Icon, id }) => (
                    <Link
                      key={href}
                      href={href}
                      prefetch={false}
                      className={styles.destination}
                      aria-current={current(href)}
                    >
                      <Icon aria-hidden="true" />
                      <span>
                        <strong>{label}</strong>
                        <small>{descriptions[id]}</small>
                      </span>
                      <ArrowUpRight aria-hidden="true" />
                    </Link>
                  ))}
                  <Link
                    href="/canvas"
                    prefetch={false}
                    className={styles.destination}
                    aria-current={current('/canvas')}
                  >
                    <Frame aria-hidden="true" />
                    <span>
                      <strong>
                        Canvas <em>Experimental</em>
                      </strong>
                      <small>Think and create on an open board</small>
                    </span>
                    <ArrowUpRight aria-hidden="true" />
                  </Link>
                </section>
                <section className={styles.section}>
                  <h3>Workspace</h3>
                  <p>Find your inspiration and your work.</p>
                  {workspaceItems.map(({ href, label, icon: Icon, id }) => (
                    <Link
                      key={href}
                      href={href}
                      prefetch={false}
                      className={styles.destination}
                      aria-current={current(href)}
                    >
                      <Icon aria-hidden="true" />
                      <span>
                        <strong>{label}</strong>
                        <small>{descriptions[id]}</small>
                      </span>
                      <ArrowUpRight aria-hidden="true" />
                    </Link>
                  ))}
                </section>
                <section className={styles.lab}>
                  <div className={styles.labHeading}>
                    <h3>
                      <FlaskConical aria-hidden="true" />
                      The Lab
                    </h3>
                    <span>{labNavItems.length} experiments</span>
                  </div>
                  <p>Try something before it becomes part of your process.</p>
                  <div className={styles.experiments}>
                    {labNavItems.map(({ href, label, description }) => (
                      <Link
                        key={href}
                        href={href}
                        prefetch={false}
                        className={styles.experiment}
                        aria-current={current(href)}
                      >
                        <span>
                          <strong>{label}</strong>
                          <small>{description}</small>
                        </span>
                        <ArrowUpRight aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                </section>
              </div>
              <footer className={styles.footer}>
                <span>Make it yours</span>
                {accountNavItems.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    prefetch={false}
                    aria-current={current(href)}
                  >
                    {label === 'Overview' ? 'Account' : label}
                  </Link>
                ))}
                <Link
                  href="/readme"
                  prefetch={false}
                  className={styles.readme}
                  aria-current={current('/readme')}
                >
                  <BookOpen aria-hidden="true" />
                  About Genzen
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              </footer>
            </nav>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
