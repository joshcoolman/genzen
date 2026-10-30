'use client'

import Link from 'next/link'
import { ChevronLeft, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NameDialog } from '../name-dialog/name-dialog'
import { Button } from '../button/button'
import styles from './subpage-header.module.css'
import type { ReactNode } from 'react'

export interface SubpageHeaderProps {
  title: string
  /** Where back goes, as a screen reader hears it: "Images", "All sessions". */
  backLabel: string
  /** Back is a link when there is a route to go to... */
  backHref?: string
  /** ...and a button when leaving is a state change, as a group is. */
  onBack?: () => void
  /**
   * Offers a pencil beside the title and owns the rename dialog. `noun` names
   * the thing in the dialog's title ("Rename session"); `onRename` throws to
   * report a failure, whose message shows inline.
   */
  rename?: { noun: string; onRename: (name: string) => Promise<void> }
  /** The end of the row: tabs, when the session has them. */
  end?: ReactNode
  /** Layout only -- the space below it, which its route decides. */
  className?: string
}

/**
 * The title of a place inside a route: an open group, a Director session, an
 * edit (#794). One row -- back, the title, an end slot -- over a hairline.
 *
 * Smaller than `PageHeader` on purpose. A group opened inside Images is a
 * subpage of Images, so its name never outweighs the route it sits in: lg
 * here against PageHeader's 2xl. It replaced GroupHeading, which drew the
 * group at 2xl, and SessionHeading and EditHeading, which were the same file
 * twice.
 *
 * The back control is round where every tool is square or a chip: it is the
 * one navigational control on the page and should not read as another tool.
 */
export function SubpageHeader({
  title,
  backLabel,
  backHref,
  onBack,
  rename,
  end,
  className,
}: SubpageHeaderProps) {
  const [shown, setShown] = useState(title)
  /* The server can rename a thing too -- a chat is titled from its first
     question (#670) -- and the refreshed prop has to win over what was typed
     here before it. */
  useEffect(() => setShown(title), [title])
  const [renaming, setRenaming] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(value: string) {
    if (!rename || busy) return
    setBusy(true)
    try {
      await rename.onRename(value)
      setShown(value)
      setRenaming(false)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Rename failed.')
    } finally {
      setBusy(false)
    }
  }

  const backIcon = <ChevronLeft className={styles.backIcon} />
  return (
    <header className={`${styles.root} ${className ?? ''}`}>
      {backHref ? (
        <Link
          href={backHref}
          className={styles.back}
          aria-label={`Back to ${backLabel}`}
          title={backLabel}
        >
          {backIcon}
        </Link>
      ) : (
        <button
          type="button"
          className={styles.back}
          aria-label={`Back to ${backLabel}`}
          title={backLabel}
          onClick={onBack}
        >
          {backIcon}
        </button>
      )}
      <h1 className={styles.title}>{shown}</h1>
      {rename && (
        <Button
          size="sm"
          disabled={busy}
          onClick={() => setRenaming(true)}
          aria-label={`Rename ${rename.noun}`}
          title={`Rename ${rename.noun}`}
        >
          <Pencil size={16} />
        </Button>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {end && <div className={styles.end}>{end}</div>}
      {rename && (
        <NameDialog
          open={renaming}
          title={`Rename ${rename.noun}`}
          initialName={shown}
          confirmLabel="Rename"
          onSubmit={(value) => void submit(value)}
          onCancel={() => setRenaming(false)}
        />
      )}
    </header>
  )
}
