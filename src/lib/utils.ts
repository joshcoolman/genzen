import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'

/** CSS Module class names. Hashed, so two of them never collide and there is
 *  nothing to merge -- conditional joining is the whole job.
 *
 *  `cn` (clsx + tailwind-merge) lived here until #186 and went with Tailwind.
 *  It had no callers left by then; there is nothing to arbitrate any more. */
export function cx(...inputs: Array<ClassValue>) {
  return clsx(inputs)
}
