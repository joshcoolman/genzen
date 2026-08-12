'use client'

import { Button as BaseButton } from '@base-ui/react/button'
import styles from './mini-button.module.css'
import type { ReactNode } from 'react'
import { cx } from '#/lib/utils'

export interface MiniButtonProps extends Omit<
  BaseButton.Props,
  'className' | 'render'
> {
  /** The icon. Sized by this component, not by the call site. */
  icon?: ReactNode
  /** Spins the icon while an action started from this chip is in flight. */
  spinning?: boolean
  /**
   * A dot at the trailing edge, for a control holding state you cannot
   * otherwise see -- system instructions being the case that earned it.
   */
  indicator?: boolean
  /**
   * `overlay` sits on top of other content and needs its own ground; `plain`
   * is transparent and takes the surface it is placed on.
   */
  variant?: 'plain' | 'overlay'
  /** Layout only -- position, margin, alignment. Not for restyling the chip. */
  className?: string
}

/**
 * The smallest labelled control on the panel: a low-contrast chip that reads as
 * an affordance beside content rather than a control of its own.
 *
 * Distinct from `Button`, which is a real call to action, and from
 * `IconButton`, which has no label. This one exists because three call sites --
 * Enhance, Instructions and Add prompt -- had arrived at the same border,
 * radius, `--text-3xs` and `0.625rem` icon independently, the second by
 * hand-copying the first (its stylesheet said so).
 */
export function MiniButton({
  icon,
  spinning = false,
  indicator = false,
  variant = 'plain',
  className,
  children,
  type = 'button',
  ...props
}: MiniButtonProps) {
  return (
    <BaseButton
      {...props}
      type={type}
      className={cx(
        styles.root,
        variant === 'overlay' && styles.overlay,
        indicator && styles.indicated,
        className,
      )}
    >
      {icon && (
        <span className={cx(styles.icon, spinning && styles.spinning)}>
          {icon}
        </span>
      )}
      {children}
    </BaseButton>
  )
}
