'use client'

import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { changeEditName } from '../../_actions/edits.action'
import styles from './edit-heading.module.css'
import type { ReactNode } from 'react'
import { Button, NameDialog } from '#/components'

/** Director's session heading, for an edit: back, the name, a pencil. */
export function EditHeading({
  id,
  name,
  children,
}: {
  id: string
  name: string
  children?: ReactNode
}) {
  const [title, setTitle] = useState(name)
  useEffect(() => setTitle(name), [name])
  const [renaming, setRenaming] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function rename(value: string) {
    if (busy) return
    setBusy(true)
    try {
      await changeEditName(id, value)
      setTitle(value)
      setRenaming(false)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Rename failed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <header className={styles.heading}>
      <Link href="/edit" aria-label="All edits" title="All edits">
        <ArrowLeft size={18} />
      </Link>
      <h1>{title}</h1>
      <Button
        size="sm"
        disabled={busy}
        onClick={() => setRenaming(true)}
        aria-label="Rename edit"
        title="Rename edit"
      >
        <Pencil size={16} />
      </Button>
      {error && <p role="alert">{error}</p>}
      <div className={styles.end}>{children}</div>
      <NameDialog
        open={renaming}
        title="Rename edit"
        initialName={title}
        confirmLabel="Rename"
        onSubmit={(value) => void rename(value)}
        onCancel={() => setRenaming(false)}
      />
    </header>
  )
}
