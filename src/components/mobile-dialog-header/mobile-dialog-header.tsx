import { X } from 'lucide-react'
import { DialogTitle } from '../dialog/dialog'
import styles from './mobile-dialog-header.module.css'

interface MobileDialogHeaderProps {
  title: string
  onClose: () => void
}

/**
 * The app bar for a full-screen mobile dialog: title left, close right, sticky
 * to the top of a scrolling body.
 *
 * Deliberately not built on `DialogHeader`. That part is a stacked column for a
 * title and its description; this is a horizontal bar, and overriding its
 * `flex-direction` from a call-site class is exactly the module-vs-module
 * ordering fight that made the Canvas badge render the wrong colour. A plain
 * div wins by not entering it.
 *
 * `DialogTitle` is what wires the dialog's `aria-labelledby`, so it has to come
 * from whichever library owns the surrounding Dialog -- a Base UI `Dialog.Title`
 * inside a Radix Dialog has no context to attach to. That is why this line
 * flipped in the same commit as both consumers (images-page, edit-page) rather
 * than ahead of them.
 */
export function MobileDialogHeader({
  title,
  onClose,
}: MobileDialogHeaderProps) {
  return (
    <div className={styles.bar}>
      <DialogTitle className={styles.title}>{title}</DialogTitle>
      <button
        type="button"
        onClick={onClose}
        className={styles.close}
        aria-label="Close"
      >
        <X className={styles.closeIcon} />
      </button>
    </div>
  )
}
