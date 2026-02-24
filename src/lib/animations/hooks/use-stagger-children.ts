'use client'

/**
 * Hook for stagger animation configuration
 * Returns variant object with stagger timing for container elements
 */

import { STAGGER } from '../config/constants'
import type { Variants } from 'framer-motion'

export interface UseStaggerChildrenOptions {
  /** Delay between each child animation */
  stagger?: number
  /** Initial delay before first child */
  delayChildren?: number
}

export function useStaggerChildren({
  stagger = STAGGER.normal,
  delayChildren = 0,
}: UseStaggerChildrenOptions = {}): Variants {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: stagger,
        delayChildren,
      },
    },
  }
}
