'use client'

import { useRef } from 'react'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { Button } from '../button/button'
import styles from './confirm-dialog.module.css'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** When true, the confirm button is styled as a destructive action. Default true. */
  destructive?: boolean
  onConfirm: () => void
  /** Fired by the Cancel button, backdrop click, and Escape key. */
  onCancel: () => void
}

/**
 * "Are you sure?" -- a title, a line of copy, Cancel, and one confirming
 * action. Every confirmation in the app is this shape, which is why it is a
 * component and not markup.
 *
 * Ported from ~/repos/bootsy, minus the two extras genzen has no use for yet
 * (a "don't ask me again" checkbox, a preview thumbnail). Base UI's AlertDialog
 * owns the focus trap, scroll lock, inert background, Escape, backdrop press
 * and focus restoration.
 *
 * Focus lands on Cancel rather than the confirm, so a reflexive Enter on open
 * cannot delete anything.
 *
 * Controlled on purpose. It was a trigger-wrapper here for about six hours,
 * which reads better in JSX but only works when a click is what opens it --
 * `useConfirm` gives the ergonomics back without the primitive having to care.
 *
 * Deltas from the bootsy original, all forced and all deliberate:
 * - Spacing tokens are translated: bootsy's scale is by index (--space-2 is
 *   8px), genzen's is by pixel (--space-2 IS 2px). Copying verbatim renders at
 *   a quarter size and nothing errors.
 * The title carries bootsy's `.house-eyebrow` treatment inlined, since genzen
 * has no global typography layer to put it in.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <AlertDialog.Root
      open={open}
      // Base UI drives every dismissal -- Escape, backdrop press, and the Close
      // (Cancel) button -- through onOpenChange(false). Confirming instead calls
      // onConfirm directly, which flips `open` externally and never re-enters
      // here, so cancel and confirm stay cleanly separate.
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel()
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={styles.backdrop} />
        <AlertDialog.Viewport className={styles.viewport}>
          <AlertDialog.Popup initialFocus={cancelRef} className={styles.popup}>
            <div className={styles.textCol}>
              <AlertDialog.Title className={styles.title}>
                {title}
              </AlertDialog.Title>
              <AlertDialog.Description className={styles.description}>
                {message}
              </AlertDialog.Description>
            </div>

            <div className={styles.footer}>
              <AlertDialog.Close
                ref={cancelRef}
                render={<Button variant="ghost" />}
              >
                {cancelLabel}
              </AlertDialog.Close>
              <Button
                variant={destructive ? 'danger' : 'primary'}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
