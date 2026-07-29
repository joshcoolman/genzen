'use client'

import { Download, Trash2, Unlink } from 'lucide-react'
import styles from './selection-actions.module.css'
import { Button, SelectionDrawer } from '#/components'

export interface SelectionActionsProps {
  count: number
  onClear: () => void
  onUnlink: () => void
  onDownload: () => void
  onDelete: () => void
}

export function SelectionActions({
  count,
  onClear,
  onUnlink,
  onDownload,
  onDelete,
}: SelectionActionsProps) {
  return (
    <SelectionDrawer count={count} onClear={onClear}>
      <Button variant="secondary" size="sm" onClick={onUnlink}>
        <Unlink className={styles.icon} />
        Unlink
      </Button>
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
