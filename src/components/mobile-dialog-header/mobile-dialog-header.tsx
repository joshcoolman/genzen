import { X } from 'lucide-react'
import { DialogTitle } from '../ui/dialog/dialog'
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
 * The `DialogTitle` import still points at the shadcn dialog, and has to: that
 * part is what wires the dialog's `aria-labelledby`, so it must come from
 * whichever library owns the surrounding Dialog. Both consumers (images-page,
 * edit-page) are still on the shadcn one, and a Base UI `Dialog.Title` inside a
 * Radix Dialog has no context to attach to. That one line flips with them, in
 * one commit, as cluster 5 of #193. Nothing else here depends on either library.
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
