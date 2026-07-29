'use client'

import { Trash2 } from 'lucide-react'
import styles from './empty-dialog.module.css'
import { ConfirmDialog, useConfirm } from '#/components'
import { Button } from '#/components/button/button'

interface EmptyDialogProps {
  /** Everything in the trash, linked or not -- the number the copy quotes when
   *  nothing is held back. */
  total: number
  /** What the server will actually destroy. Linked rows survive an empty. */
  deletable: number
  busy: boolean
  onConfirm: () => void
}

export function EmptyDialog({
  total,
  deletable,
  busy,
  onConfirm,
}: EmptyDialogProps) {
  const kept = total - deletable
  const { confirm, dialogProps } = useConfirm()

  const message =
    kept > 0
      ? `This will permanently delete ${deletable} ${deletable === 1 ? 'item' : 'items'} and their files. ${kept} linked ${kept === 1 ? 'item' : 'items'} will be kept because active images depend on ${kept === 1 ? 'it' : 'them'}. This action cannot be undone.`
      : `This will permanently delete ${total} ${total === 1 ? 'item' : 'items'} and their files. This action cannot be undone.`

  async function ask() {
    const ok = await confirm({
      title: 'Empty Trash?',
      message,
      confirmLabel: kept > 0 ? `Delete ${deletable} Items` : 'Delete All',
    })
    if (ok) onConfirm()
  }

  return (
    <>
      <Button
        variant="danger"
        size="sm"
        disabled={busy || deletable === 0}
        onClick={() => void ask()}
      >
        <Trash2 className={styles.icon} />
        Empty Trash
      </Button>
      <ConfirmDialog {...dialogProps} />
    </>
  )
}
