import styles from './textarea.module.css'
import type { ComponentProps } from 'react'

export interface TextareaProps extends ComponentProps<'textarea'> {
  /** Layout only -- width, flex, padding for an overlaid button, `resize`.
   *  Not for restyling the control. */
  className?: string
}

/**
 * A multi-line text field. Hand-rolled over a plain `<textarea>`: Base UI has
 * no textarea, and its `Field` only wraps one rather than replacing it, so
 * there is nothing to adopt.
 */
export function Textarea({ className, ...props }: TextareaProps) {
  return <textarea {...props} className={`${styles.root} ${className ?? ''}`} />
}
