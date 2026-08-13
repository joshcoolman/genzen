'use client'

import { useEffect, useState } from 'react'
import styles from './group-name-dialog.module.css'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '#/components'

interface GroupNameDialogProps {
  open: boolean
  /** "New group" when creating, the current name when renaming. */
  title: string
  initialName?: string
  confirmLabel: string
  onSubmit: (name: string) => void
  onCancel: () => void
}

/**
 * A name, and nothing else (#319).
 *
 * The only modal step in the whole feature, and it stays that way on purpose:
 * the previous attempt at grouping also asked which image should represent the
 * group, and that second question is what turned "these go together" into a
 * chore. The cover is picked automatically and changed later from an image's
 * own menu, so this is one field and two buttons.
 *
 * Enter submits, because a one-field dialog that makes you aim at a button is
 * asking for a click it does not need.
 */
export function GroupNameDialog({
  open,
  title,
  initialName = '',
  confirmLabel,
  onSubmit,
  onCancel,
}: GroupNameDialogProps) {
  const [name, setName] = useState(initialName)

  // Reseeded on open rather than on mount: the dialog stays mounted between
  // uses, so without this a rename would show whatever the last one typed.
  useEffect(() => {
    if (open) setName(initialName)
  }, [open, initialName])

  const trimmed = name.trim()

  function submit() {
    if (!trimmed) return
    onSubmit(trimmed)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <DialogContent className={styles.content}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <Input
          autoFocus
          value={name}
          placeholder="Name"
          maxLength={200}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
        />

        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" disabled={!trimmed} onClick={submit}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
