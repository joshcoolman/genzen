import styles from './badge.module.css'
import type { ComponentProps } from 'react'

export interface BadgeProps extends ComponentProps<'span'> {
  /** Colour. The pill, border, padding and type are the badge's; the hue is
   *  the call site's, because every badge in the app means something different. */
  className?: string
}

/**
 * A pill of metadata. Hand-rolled, not ported and not wrapped -- no headless
 * library has a badge, because there is nothing headless about it: it has no
 * state, no behaviour and no accessibility contract.
 *
 * Deliberately variant-less, unlike the shadcn one it replaces. That had seven
 * variants and the app used two of them; a `variant` prop here would be an
 * invitation to re-grow the other five. The one shape is an outlined pill, and
 * a badge that wants a colour brings its own class.
 */
export function Badge({ className, ...props }: BadgeProps) {
  return <span {...props} className={`${styles.root} ${className ?? ''}`} />
}
