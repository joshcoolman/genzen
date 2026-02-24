'use client'

/**
 * Flexible wrapper accepting all Framer Motion props
 * Most customizable component - use when other components don't fit needs
 */

import { motion } from 'framer-motion'
import type { MotionProps } from 'framer-motion'
import type { ElementType, ReactNode } from 'react'

export interface AnimatedWrapperProps extends MotionProps {
  children: ReactNode
  /** Element type to render (default: div) */
  as?: ElementType
}

export function AnimatedWrapper({
  children,
  as = 'div',
  ...motionProps
}: AnimatedWrapperProps) {
  const Component = motion.create(as as any)

  return <Component {...motionProps}>{children}</Component>
}
