'use client'

import { Button as BaseButton } from '@base-ui/react/button'
import { Loader2 } from 'lucide-react'
import styles from './button.module.css'
import type { ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

export interface ButtonProps extends Omit<
  BaseButton.Props,
  'className' | 'render' | 'children'
> {
  /** Optional because Base UI's `render` composition supplies children externally. */
  children?: ReactNode
  /** @default 'secondary' */
  variant?: ButtonVariant
  /** @default 'md' */
  size?: ButtonSize
  /**
   * Shows a spinner and blocks interaction. Prefer this over disabling by hand:
   * it also sets `aria-busy`, which a plain `disabled` does not.
   */
  loading?: boolean
  /** Escape hatch for layout only (width, margin) — not for restyling a variant. */
  className?: string
}

/**
 * Ported from `~/repos/bootsy`, which got here first. Four variants covering
 * the treatments that had already converged there by copy-paste, one canonical
 * disabled state, and a real loading affordance.
 *
 * Base UI's Button is thin, but supplies the parts worth not hand-rolling:
 * `data-disabled` to style against, `focusableWhenDisabled` semantics, and
 * consistent focus handling. The look is entirely ours and lives in
 * button.module.css.
 *
 * Not every `<button>` belongs here. Icon-only buttons and invisible hit-target
 * wrappers (thumbnails, list rows, backdrop catchers) are a different problem
 * and deliberately still hand-rolled.
 *
 * Genzen deltas from the bootsy original, both forced by token meanings that
 * have not merged yet:
 * - `primary` reads `--accent-brand`, not `--accent`, which here is a grey.
 * - `danger` reads genzen's `--danger`, a more saturated red than bootsy's.
 */
export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      {...props}
      type={type}
      // So a container can style its own buttons without reaching for a hashed
      // module class -- the selection drawer greens everything but the danger.
      data-variant={variant}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${styles.root} ${styles[variant]} ${styles[size]} ${className ?? ''}`}
    >
      {loading && <Loader2 className={styles.spinner} aria-hidden />}
      {children}
    </BaseButton>
  )
}
