'use client'

import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { changeSessionName } from '../../_actions/sessions.action'
import styles from './session-heading.module.css'
import type { ReactNode } from 'react'
import { Button, NameDialog } from '#/components'

export function SessionHeading({
  id,
  name,
  children,
}: {
  id: string
  name: string
  children?: ReactNode
}) {
  const [title, setTitle] = useState(name)
  /* The server can rename a session too -- a chat is titled from its first
     question (#670) -- and the refreshed prop has to win over what was typed
     here before it. */
  useEffect(() => setTitle(name), [name])
  const [renaming, setRenaming] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function rename(value: string) {
    if (busy) return
    setBusy(true)
    try {
      await changeSessionName(id, value)
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
      <Link href="/director" aria-label="All sessions" title="All sessions">
        <ArrowLeft size={18} />
      </Link>
      <h1>{title}</h1>
      <Button
        size="sm"
        disabled={busy}
        onClick={() => setRenaming(true)}
        aria-label="Rename session"
        title="Rename session"
      >
        <Pencil size={16} />
      </Button>
      {error && <p role="alert">{error}</p>}
      <div className={styles.end}>{children}</div>
      <NameDialog
        open={renaming}
        title="Rename session"
        initialName={title}
        confirmLabel="Rename"
        onSubmit={(value) => void rename(value)}
        onCancel={() => setRenaming(false)}
      />
    </header>
  )
}
