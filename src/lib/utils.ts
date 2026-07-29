import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ClassValue } from 'clsx'

/** Utility classes, where later wins and `tailwind-merge` has to arbitrate.
 *  Goes with Tailwind in #186; converted code reaches for `cx`. */
export function cn(...inputs: Array<ClassValue>) {
  return twMerge(clsx(inputs))
}

/** CSS Module class names. Hashed, so two of them never collide and there is
 *  nothing to merge -- conditional joining is the whole job. */
export function cx(...inputs: Array<ClassValue>) {
  return clsx(inputs)
}
