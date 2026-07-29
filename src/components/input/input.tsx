'use client'

import { Input as BaseInput } from '@base-ui/react/input'
import styles from './input.module.css'
import type { ComponentProps } from 'react'

export interface InputProps extends Omit<
  ComponentProps<typeof BaseInput>,
  'className' | 'render'
> {
  /** Layout only -- width, margin. Not for restyling the control. */
  className?: string
}

/**
 * A single-line text field. Base UI's Input over a bare `<input>` for one
 * reason: it carries Field state (invalid, dirty, touched) as data-attributes,
 * so a form wrapper can style the control without the control knowing about it.
 *
 * The look is the shadcn input's, minus its `shadow-sm` -- a shadow on a dark
 * surface renders as nothing but costs a paint.
 */
export function Input({ className, ...props }: InputProps) {
  return (
    <BaseInput {...props} className={`${styles.root} ${className ?? ''}`} />
  )
}
