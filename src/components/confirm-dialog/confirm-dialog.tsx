'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog/alert-dialog'
import type { ReactNode } from 'react'

export interface ConfirmDialogProps {
  /** The control that opens it. Rendered `asChild`, so it must forward a ref
   *  and spread props -- any `Button` does. */
  children: ReactNode
  title: string
  /** ReactNode rather than string: the copy is often conditional on a count. */
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
}

/**
 * "Are you sure?" -- title, a line of copy, Cancel, and one confirming action.
 *
 * Nine imports and thirty lines of nesting were repeated verbatim at five call
 * sites, varying only in their strings. This is that shape with the strings as
 * props.
 *
 * Deliberately not general. The confirming button is always the default
 * variant, because every call site wanted that; the *trigger* is the thing that
 * differs, and it is `children`. A call site with a genuinely different need --
 * the sidebar wraps its trigger in a Tooltip -- keeps composing `AlertDialog`
 * by hand rather than growing a prop here.
 */
export function ConfirmDialog({
  children,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
