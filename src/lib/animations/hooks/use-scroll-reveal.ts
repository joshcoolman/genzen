'use client'

/**
 * Hook for scroll-triggered animations
 * Uses Framer Motion's useInView hook to trigger animations when element enters viewport
 */

import { useInView } from 'framer-motion'
import { useRef } from 'react'
import { SCROLL_THRESHOLD } from '../config/constants'

export interface UseScrollRevealOptions {
  /** Viewport visibility percentage to trigger animation (0-1) */
  threshold?: number
  /** Only trigger animation once */
  once?: boolean
  /** Root margin for trigger zone */
  margin?: string
}

export function useScrollReveal({
  threshold = SCROLL_THRESHOLD.quarter,
  once = true,
  margin = '0px',
}: UseScrollRevealOptions = {}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, {
    once,
    amount: threshold,
    margin: margin as any, // margin type accepts string but TypeScript is strict
  })

  return { ref, isInView }
}
