'use client'

import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import { useState } from 'react'
import { changeSessionName } from '../../_actions/sessions.action'
import styles from './session-heading.module.css'
import { Button, NameDialog } from '#/components'

export function SessionHeading({ id, name }: { id: string; name: string }) {
  const [title, setTitle] = useState(name)
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
      <Link href="/director">
        <ArrowLeft size={16} />
        Director
      </Link>
      <div>
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
      </div>
      {error && <p role="alert">{error}</p>}
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
