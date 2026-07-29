'use client'

import { RotateCcw, Trash2 } from 'lucide-react'
import styles from './selection-bar.module.css'
import { ConfirmDialog, SelectionDrawer } from '#/components'
import { Button } from '#/components/button/button'

interface SelectionBarProps {
  count: number
  busy: boolean
  onClear: () => void
  onRestore: () => void
  onDelete: () => void
}

export function SelectionBar({
  count,
  busy,
  onClear,
  onRestore,
  onDelete,
}: SelectionBarProps) {
  return (
    <SelectionDrawer count={count} onClear={onClear}>
      <Button variant="ghost" size="sm" disabled={busy} onClick={onRestore}>
        <RotateCcw className={styles.icon} />
        Restore ({count})
      </Button>
      <ConfirmDialog
        title={`Delete ${count} ${count === 1 ? 'item' : 'items'}?`}
        description={
          <>
            This will permanently delete {count}{' '}
            {count === 1 ? 'item' : 'items'} and their files. Linked items will
            be skipped. This action cannot be undone.
          </>
        }
        confirmLabel="Delete Forever"
        onConfirm={onDelete}
      >
        <Button variant="danger" size="sm" disabled={busy}>
          <Trash2 className={styles.icon} />
          Delete ({count})
        </Button>
      </ConfirmDialog>
    </SelectionDrawer>
  )
}
