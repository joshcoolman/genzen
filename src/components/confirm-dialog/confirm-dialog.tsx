'use client'

import { useRef } from 'react'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { Button } from '../button/button'
import styles from './confirm-dialog.module.css'
import type { ButtonVariant } from '../button/button'

export interface ConfirmChoice {
  label: string
  onClick: () => void
  /** @default 'secondary' */
  variant?: ButtonVariant
  disabled?: boolean
}

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** When true, the confirm button is styled as a destructive action. Default true. */
  destructive?: boolean
  /**
   * Replaces the single confirm button with several. For questions that are a
   * choice between outcomes rather than yes-or-no -- "delete just this, or all
   * of them?" -- where forcing the shape into confirm/cancel loses the
   * distinction. Cancel is still supplied, and still holds initial focus.
   */
  choices?: Array<ConfirmChoice>
  onConfirm: () => void
  /** Fired by the Cancel button, backdrop click, and Escape key. */
  onCancel: () => void
}

/**
 * "Are you sure?" -- a title, a line of copy, Cancel, and one confirming
 * action. Every confirmation in the app is this shape, which is why it is a
 * component and not markup.
 *
 * `choices` swaps the single action for several, for the questions that are a
 * choice between outcomes rather than yes-or-no. Focus policy does not change:
 * Cancel still holds it, which matters more with three destructive-ish buttons
 * than with one.
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
  choices,
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

            <div
              className={`${styles.footer} ${choices ? styles.footerStacked : ''}`}
            >
              <AlertDialog.Close
                ref={cancelRef}
                render={
                  <Button
                    variant="ghost"
                    className={choices ? styles.cancelLast : undefined}
                  />
                }
                disabled={choices?.every((c) => c.disabled)}
              >
                {cancelLabel}
              </AlertDialog.Close>
              {choices ? (
                choices.map((choice) => (
                  <Button
                    key={choice.label}
                    variant={choice.variant ?? 'secondary'}
                    disabled={choice.disabled}
                    onClick={choice.onClick}
                  >
                    {choice.label}
                  </Button>
                ))
              ) : (
                <Button
                  variant={destructive ? 'danger' : 'primary'}
                  onClick={onConfirm}
                >
                  {confirmLabel}
                </Button>
              )}
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
