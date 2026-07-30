'use client'

import styles from './delete-confirm.module.css'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components'

interface DeleteConfirmProps {
  /** The ids awaiting a choice, or null when the modal is closed. */
  pending: { ids: Array<string> } | null
  onClose: () => void
  onRemoveFromCanvas: (ids: Array<string>) => void
  onMoveToTrash: (ids: Array<string>) => void
}

/** Delete is two different operations, so the modal asks which one rather than
 *  picking for the user -- the toast this replaced was too easy to miss. */
export function DeleteConfirm({
  pending,
  onClose,
  onRemoveFromCanvas,
  onMoveToTrash,
}: DeleteConfirmProps) {
  const choose = (action: (ids: Array<string>) => void) => () => {
    if (pending) action(pending.ids)
    onClose()
  }

  return (
    <Dialog open={!!pending} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={styles.confirmPopup}>
        <DialogHeader>
          <DialogTitle>
            {pending && pending.ids.length > 1
              ? `Delete ${pending.ids.length} images?`
              : 'Delete this image?'}
          </DialogTitle>
          <DialogDescription>
            Remove it from the canvas (it stays in your library), or move it to
            Trash.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className={styles.confirmFooter}>
          <Button
            variant="secondary"
            className={styles.confirmAction}
            onClick={choose(onRemoveFromCanvas)}
          >
            Remove from Canvas
          </Button>
          <Button
            variant="danger"
            className={styles.confirmAction}
            onClick={choose(onMoveToTrash)}
          >
            Move to Trash
          </Button>
          <Button
            variant="ghost"
            className={styles.confirmAction}
            onClick={onClose}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
