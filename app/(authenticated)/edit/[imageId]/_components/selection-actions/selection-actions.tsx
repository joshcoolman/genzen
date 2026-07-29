'use client'

import { Download, Trash2 } from 'lucide-react'
import styles from './selection-actions.module.css'
import { Button, SelectionDrawer } from '#/components'

export interface SelectionActionsProps {
  count: number
  onClear: () => void
  onDownload: () => void
  onDelete: () => void
}

export function SelectionActions({
  count,
  onClear,
  onDownload,
  onDelete,
}: SelectionActionsProps) {
  return (
    <SelectionDrawer count={count} onClear={onClear}>
      <Button variant="secondary" size="sm" onClick={onDownload}>
        <Download className={styles.icon} />
        Download
      </Button>
      <Button variant="secondary" size="sm" onClick={onDelete}>
        <Trash2 className={styles.icon} />
        Delete
      </Button>
    </SelectionDrawer>
  )
}
