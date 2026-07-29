'use client'

import { useState } from 'react'
import type { ConfirmDialogProps } from './confirm-dialog'

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  /** @default true */
  destructive?: boolean
}

interface PendingConfirm {
  options: ConfirmOptions
  resolve: (confirmed: boolean) => void
}

export interface UseConfirm {
  /** Opens the dialog and resolves true or false with the user's choice. */
  confirm: (options: ConfirmOptions) => Promise<boolean>
  /** Spread straight into `<ConfirmDialog />`. */
  dialogProps: ConfirmDialogProps
}

/**
 * Turns the controlled `ConfirmDialog` into one `await`.
 *
 *   if (await confirm({ title: 'Delete forever?', message })) onDelete(id)
 *
 * The dialog is controlled because that is what Base UI's AlertDialog wants and
 * what makes it usable from a handler rather than only from a click. This puts
 * the `open` state in one place instead of at every call site.
 *
 * Bootsy's equivalent, `useConfirmDelete`, also owns a "don't ask me again"
 * preference keyed by scope. That did not come across -- it depends on a prefs
 * store genzen does not have, and no genzen surface has asked to be silenced.
 */
export function useConfirm(): UseConfirm {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => setPending({ options, resolve }))
  }

  function settle(confirmed: boolean): void {
    pending?.resolve(confirmed)
    setPending(null)
  }

  return {
    confirm,
    dialogProps: {
      open: pending !== null,
      title: pending?.options.title ?? '',
      message: pending?.options.message ?? '',
      confirmLabel: pending?.options.confirmLabel,
      destructive: pending?.options.destructive,
      onConfirm: () => settle(true),
      onCancel: () => settle(false),
    },
  }
}
