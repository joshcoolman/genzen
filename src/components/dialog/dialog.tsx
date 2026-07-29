'use client'

import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import styles from './dialog.module.css'
import type { ComponentProps, ReactNode } from 'react'

/**
 * The house dialog, on Base UI. Bootsy has no shared Dialog to port -- its
 * `error-details-dialog` is one dialog written straight against Base UI's parts
 * -- so this is that shell generalised, with `ConfirmDialog` as the sibling
 * that stays specialised.
 *
 * The part names deliberately mirror shadcn's (`DialogContent`, not
 * `DialogPopup`), because 17 files still consume that one and the eventual swap
 * should be an import change, not a rewrite. Two shadcn parts do not exist in
 * Base UI at all -- `DialogHeader` and `DialogFooter` are flex divs it invented
 * -- and this supplies them rather than making 50 and 20 call sites lay
 * themselves out.
 *
 * `DialogContent` collapses Portal + Backdrop + Viewport + Popup into one part,
 * matching shadcn's shape. Reach for the Base UI parts directly if a dialog
 * ever needs to portal somewhere unusual.
 *
 * Base UI owns the focus trap, scroll lock, inert background, Escape and
 * backdrop press. What it does not own: sizing children's SVGs. Icons render at
 * 24px until the call site sizes them.
 */
export function Dialog(props: ComponentProps<typeof BaseDialog.Root>) {
  return <BaseDialog.Root {...props} />
}

/**
 * Base UI composes through `render`, not `asChild`:
 *   <DialogTrigger render={<Button variant="secondary" />}>Download</DialogTrigger>
 */
export function DialogTrigger(
  props: ComponentProps<typeof BaseDialog.Trigger>,
) {
  return <BaseDialog.Trigger {...props} />
}

export function DialogClose(props: ComponentProps<typeof BaseDialog.Close>) {
  return <BaseDialog.Close {...props} />
}

export interface DialogContentProps {
  children: ReactNode
  /**
   * Layout only. Set size and scrolling through the popup's custom properties
   * rather than by re-declaring the properties themselves, which races this
   * module on bundle order -- see dialog.module.css:
   *   `--dialog-max-width`, `--dialog-max-height`, `--dialog-overflow`.
   */
  className?: string
  /** @default true */
  showCloseButton?: boolean
  /**
   * `wide` sizes off the viewport (66vw x 80vh) instead of off content -- for
   * dialogs that are a grid, where the default 32rem shows two thumbnails.
   * @default 'default'
   */
  size?: 'default' | 'wide'
  /**
   * Where focus lands on open. Point it at the safe control when the dialog
   * can destroy something -- `ConfirmDialog` focuses Cancel for exactly that.
   */
  initialFocus?: ComponentProps<typeof BaseDialog.Popup>['initialFocus']
}

export function DialogContent({
  children,
  className,
  showCloseButton = true,
  size = 'default',
  initialFocus,
}: DialogContentProps) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className={styles.backdrop} />
      <BaseDialog.Viewport className={styles.viewport}>
        <BaseDialog.Popup
          initialFocus={initialFocus}
          className={`${styles.popup} ${size === 'wide' ? styles.wide : ''} ${className ?? ''}`}
        >
          {children}
          {showCloseButton && (
            <BaseDialog.Close className={styles.closeButton}>
              <X className={styles.closeIcon} />
              <span className={styles.srOnly}>Close</span>
            </BaseDialog.Close>
          )}
        </BaseDialog.Popup>
      </BaseDialog.Viewport>
    </BaseDialog.Portal>
  )
}

export function DialogHeader({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`${styles.header} ${className ?? ''}`}>{children}</div>
}

export function DialogFooter({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`${styles.footer} ${className ?? ''}`}>{children}</div>
}

export function DialogTitle({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <BaseDialog.Title className={`${styles.title} ${className ?? ''}`}>
      {children}
    </BaseDialog.Title>
  )
}

export function DialogDescription({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <BaseDialog.Description
      className={`${styles.description} ${className ?? ''}`}
    >
      {children}
    </BaseDialog.Description>
  )
}
