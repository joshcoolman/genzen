'use client'

import { useEffect, useState } from 'react'
import { Button } from '../button/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../dialog/dialog'
import { Input } from '../input/input'
import styles from './name-dialog.module.css'

interface NameDialogProps {
  open: boolean
  /** "New canvas", "Rename group" -- what the dialog is for, in the header. */
  title: string
  initialName?: string
  confirmLabel: string
  onSubmit: (name: string) => void
  onCancel: () => void
}

/**
 * A name, and nothing else (#319, shared with canvases in #446).
 *
 * Written for groups, where it is the only modal step in the feature and stays
 * that way on purpose: the previous attempt at grouping also asked which image
 * should represent the group, and that second question is what turned "these go
 * together" into a chore. Naming a canvas asks exactly as little, which is why
 * this is a primitive rather than two dialogs.
 *
 * Enter submits, because a one-field dialog that makes you aim at a button is
 * asking for a click it does not need.
 */
export function NameDialog({
  open,
  title,
  initialName = '',
  confirmLabel,
  onSubmit,
  onCancel,
}: NameDialogProps) {
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
