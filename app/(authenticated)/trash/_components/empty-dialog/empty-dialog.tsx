'use client'

import { Trash2 } from 'lucide-react'
import styles from './empty-dialog.module.css'
import { Button, ConfirmDialog, useConfirm } from '#/components'

interface EmptyDialogProps {
  /** Everything in the trash, locked or not -- the number the copy quotes when
   *  nothing is held back. */
  total: number
  /** What the server will actually destroy. Rows still on a canvas survive. */
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
      ? `This will permanently delete ${deletable} ${deletable === 1 ? 'item' : 'items'} and their files. ${kept} ${kept === 1 ? 'item is' : 'items are'} still on the canvas and will be kept -- remove ${kept === 1 ? 'it' : 'them'} from the canvas to delete ${kept === 1 ? 'it' : 'them'}. This action cannot be undone.`
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
