'use client'

import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import styles from './sheet.module.css'
import type { ComponentProps, ReactNode } from 'react'

/**
 * An edge-anchored panel. Built on Base UI's Dialog, not its Drawer, because
 * shadcn's Sheet was a Radix Dialog and this is a like-for-like port -- same
 * modality, same focus trap, same dismissal. Drawer is the upgrade path when
 * these want swipe-to-dismiss; it brings its own viewport/swipe-area parts and
 * is a behaviour change, not a conversion.
 *
 * Deliberately a subset of shadcn's eight parts: the rest had no consumer.
 *
 * Unlike Dialog, this one animates. A panel that slides in from an edge with no
 * travel reads as a glitch rather than as a surface arriving.
 */
export function Sheet(props: ComponentProps<typeof BaseDialog.Root>) {
  return <BaseDialog.Root {...props} />
}

export interface SheetContentProps {
  children: ReactNode
  /**
   * Layout only. Size and surface come through the popup's custom properties
   * rather than by re-declaring them -- see sheet.module.css:
   *   `--sheet-width`, `--sheet-max-width`, `--sheet-background`,
   *   `--sheet-padding`, `--sheet-gap`.
   */
  className?: string
  /** @default 'right'. `bottom` is the phone's sheet: full width, as tall as
   *  its content up to `--sheet-max-height`. */
  side?: 'left' | 'right' | 'bottom'
  /** @default true */
  showCloseButton?: boolean
}

export function SheetContent({
  children,
  className,
  side = 'right',
  showCloseButton = true,
}: SheetContentProps) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className={styles.backdrop} />
      <BaseDialog.Popup
        className={`${styles.popup} ${styles[side]} ${className ?? ''}`}
      >
        {children}
        {showCloseButton && (
          <BaseDialog.Close className={styles.closeButton}>
            <X className={styles.closeIcon} />
            <span className={styles.srOnly}>Close</span>
          </BaseDialog.Close>
        )}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  )
}

export function SheetHeader({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`${styles.header} ${className ?? ''}`}>{children}</div>
}

export function SheetTitle({
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
