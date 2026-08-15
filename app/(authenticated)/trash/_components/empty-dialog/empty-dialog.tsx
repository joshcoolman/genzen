'use client'

import { Trash2 } from 'lucide-react'
import styles from './empty-dialog.module.css'
import { Button, ConfirmDialog, useConfirm } from '#/components'

interface EmptyDialogProps {
  /** Everything in the trash. Nothing is held back any more (#371). */
  total: number
  busy: boolean
  onConfirm: () => void
}

export function EmptyDialog({ total, busy, onConfirm }: EmptyDialogProps) {
  const { confirm, dialogProps } = useConfirm()

  async function ask() {
    const ok = await confirm({
      title: 'Empty Trash?',
      message: `This will permanently delete ${total} ${total === 1 ? 'item' : 'items'} and their files. This action cannot be undone.`,
      confirmLabel: 'Delete All',
    })
    if (ok) onConfirm()
  }

  return (
    <>
      <Button
        variant="danger"
        size="sm"
        disabled={busy || total === 0}
        onClick={() => void ask()}
      >
        <Trash2 className={styles.icon} />
        Empty Trash
      </Button>
      <ConfirmDialog {...dialogProps} />
    </>
  )
}
