'use client'

/**
 * Generic scroll reveal wrapper
 * Accepts custom variants for flexible animations
 */

import { motion } from 'framer-motion'
import { useScrollReveal } from '../hooks/use-scroll-reveal'
import { transitions } from '../config/transitions'
import type { Transition, Variants } from 'framer-motion'
import type { ReactNode } from 'react'
import type { TransitionPreset } from '../config/transitions'

export interface ScrollRevealProps {
  children: ReactNode
  className?: string
  /** Animation variants to use */
  variants: Variants
  /** Viewport visibility threshold (0-1) */
  threshold?: number
  /** Only animate once */
  once?: boolean
  /** Delay before animation starts */
  delay?: number
  /** Transition preset or custom transition */
  transition?: TransitionPreset | Transition
}

export function ScrollReveal({
  children,
  className,
  variants,
  threshold,
  once,
  delay = 0,
  transition = 'smooth',
}: ScrollRevealProps) {
  const { ref, isInView } = useScrollReveal({ threshold, once })

  // Use preset if string, otherwise use custom transition
  const transitionConfig =
    typeof transition === 'string' ? transitions[transition] : transition

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={variants}
      transition={{ ...transitionConfig, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
