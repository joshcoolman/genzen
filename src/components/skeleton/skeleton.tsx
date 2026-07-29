import styles from './skeleton.module.css'
import type { ComponentProps } from 'react'

/**
 * A pulsing placeholder box. Hand-rolled: there is no headless equivalent
 * because there is nothing headless about it -- no state, no behaviour, no
 * accessibility contract beyond staying out of the accessibility tree.
 *
 * It has no size of its own. Every call site is placing it in a specific hole,
 * so the hole's dimensions belong to the call site's class, not here.
 */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden="true"
      {...props}
      className={`${styles.root} ${className ?? ''}`}
    />
  )
}
