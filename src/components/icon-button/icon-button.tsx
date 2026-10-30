'use client'

import { Button as BaseButton } from '@base-ui/react/button'
import styles from './icon-button.module.css'
import type { ReactNode } from 'react'
import type { ButtonSize } from '../button/button'

export interface IconButtonProps extends Omit<
  BaseButton.Props,
  'className' | 'render' | 'children'
> {
  /** The icon. Sized by this component, not by the call site. */
  children?: ReactNode
  /** Button's three heights, so an IconButton beside a Button matches it. @default 'lg' */
  size?: ButtonSize
  /** Layout only -- margin, alignment. Not for restyling the control. */
  className?: string
  /** Required: an icon-only control has no accessible name without it. */
  'aria-label'?: string
}

/**
 * A square, bordered, icon-only button.
 *
 * Separate from `Button` because Button's own note excludes exactly this shape:
 * it is not a label with an icon beside it, it is a target with a glyph in it,
 * and giving Button a `size="icon"` would reopen the variant sprawl that port
 * was closing. Three call sites had it as shadcn's `variant="outline"
 * size="icon"`, identically, which is what earned the component.
 *
 * Not to be confused with `ExpandableIconButton`, which is the overlay
 * treatment that grows on hover over an image.
 */
export function IconButton({
  children,
  className,
  size = 'lg',
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <BaseButton
      {...props}
      type={type}
      className={`${styles.root} ${styles[size]} ${className ?? ''}`}
    >
      {children}
    </BaseButton>
  )
}
