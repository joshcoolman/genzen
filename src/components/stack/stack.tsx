import { clsx } from 'clsx'
import styles from './stack.module.css'
import type { ReactNode } from 'react'

/** Deliberately two props. `Stack` exists so a route's `view.tsx` can compose
 *  without styling; every prop added here is a styling decision creeping back
 *  into the view. Alignment, padding and width belong to the components being
 *  stacked, or to a component built for the job. */
export interface StackProps {
  gap: 4 | 8 | 12 | 16 | 24 | 32
  direction?: 'column' | 'row'
  children: ReactNode
}

const GAPS = {
  4: styles.gap4,
  8: styles.gap8,
  12: styles.gap12,
  16: styles.gap16,
  24: styles.gap24,
  32: styles.gap32,
} as const

export function Stack({ gap, direction = 'column', children }: StackProps) {
  return (
    <div
      className={clsx(
        styles.stack,
        direction === 'row' && styles.row,
        GAPS[gap],
      )}
    >
      {children}
    </div>
  )
}
