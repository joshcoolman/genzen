'use client'

/**
 * Container that staggers children animations
 * Critical for grid/list animations where items appear sequentially
 */

import { motion } from 'framer-motion'
import { useScrollReveal } from '../hooks/use-scroll-reveal'
import { useStaggerChildren } from '../hooks/use-stagger-children'
import type { ReactNode } from 'react'

export interface StaggerContainerProps {
  children: ReactNode
  className?: string
  /** Delay between each child animation */
  stagger?: number
  /** Initial delay before first child */
  delayChildren?: number
  /** Viewport visibility threshold (0-1) */
  threshold?: number
  /** Only animate once */
  once?: boolean
}

export function StaggerContainer({
  children,
  className,
  stagger,
  delayChildren,
  threshold,
  once,
}: StaggerContainerProps) {
  const { ref, isInView } = useScrollReveal({ threshold, once })
  const variants = useStaggerChildren({ stagger, delayChildren })

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  )
}
