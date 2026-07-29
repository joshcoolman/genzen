'use client'

import { Trash2 } from 'lucide-react'
import styles from './selection-actions.module.css'
import { Button, SelectionDrawer } from '#/components'

interface SelectionActionsProps {
  count: number
  busy: boolean
  onClear: () => void
  onDelete: () => void
}

/** The drawer that rises once anything in the gallery is selected. */
export function SelectionActions({
  count,
  busy,
  onClear,
  onDelete,
}: SelectionActionsProps) {
  return (
    <SelectionDrawer count={count} onClear={onClear}>
      <Button variant="danger" size="sm" disabled={busy} onClick={onDelete}>
        <Trash2 className={styles.icon} />
        {busy ? 'Deleting...' : `Delete (${count})`}
      </Button>
    </SelectionDrawer>
  )
}
