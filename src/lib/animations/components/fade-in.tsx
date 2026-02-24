'use client'

/**
 * Simple fade-in component with scroll reveal
 * Wraps children with motion.div and fades in when scrolled into view
 */

import { motion } from 'framer-motion'
import { useScrollReveal } from '../hooks/use-scroll-reveal'
import { fadeIn } from '../config/variants'
import type { ReactNode } from 'react'

export interface FadeInProps {
  children: ReactNode
  className?: string
  /** Delay before animation starts */
  delay?: number
  /** Viewport visibility threshold (0-1) */
  threshold?: number
  /** Only animate once */
  once?: boolean
}

export function FadeIn({
  children,
  className,
  delay = 0,
  threshold,
  once,
}: FadeInProps) {
  const { ref, isInView } = useScrollReveal({ threshold, once })

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={fadeIn}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
