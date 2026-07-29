'use client'

import { RotateCcw, Trash2 } from 'lucide-react'
import styles from './selection-bar.module.css'
import { ConfirmDialog, SelectionDrawer, useConfirm } from '#/components'
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
  const { confirm, dialogProps } = useConfirm()
  const noun = count === 1 ? 'item' : 'items'

  async function ask() {
    const ok = await confirm({
      title: `Delete ${count} ${noun}?`,
      message: `This will permanently delete ${count} ${noun} and their files. Linked items will be skipped. This action cannot be undone.`,
      confirmLabel: 'Delete Forever',
    })
    if (ok) onDelete()
  }

  return (
    <>
      <SelectionDrawer count={count} onClear={onClear}>
        <Button variant="ghost" size="sm" disabled={busy} onClick={onRestore}>
          <RotateCcw className={styles.icon} />
          Restore ({count})
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={busy}
          onClick={() => void ask()}
        >
          <Trash2 className={styles.icon} />
          Delete ({count})
        </Button>
      </SelectionDrawer>
      <ConfirmDialog {...dialogProps} />
    </>
  )
}
