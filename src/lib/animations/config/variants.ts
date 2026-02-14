/**
 * Animation variant definitions
 * Reusable animation states for Framer Motion
 */

import { Variants } from 'framer-motion'
import { transitions } from './transitions'
import { STAGGER } from './constants'

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: transitions.smooth,
  },
}

export const fadeInUp: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.smooth,
  },
}

export const fadeInDown: Variants = {
  hidden: {
    opacity: 0,
    y: -20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.smooth,
  },
}

export const fadeInLeft: Variants = {
  hidden: {
    opacity: 0,
    x: -30,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.smooth,
  },
}

export const fadeInRight: Variants = {
  hidden: {
    opacity: 0,
    x: 30,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.smooth,
  },
}

export const scaleIn: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transitions.smooth,
  },
}

/**
 * Spring Animation Variants
 * Systematic library of spring-based animations with fast/slow variants
 */

// Zoom In (with scale) - Fast
export const springZoomIn: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
    y: 10,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
      mass: 0.5,
    },
  },
}

// Zoom In (with scale) - Slow (smoother settle)
export const springZoomInSlow: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
    y: 10,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 30,
      mass: 0.8,
    },
  },
}

// Slide Up (no scale) - Fast
export const springSlideUp: Variants = {
  hidden: {
    opacity: 0,
    y: 40,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
      mass: 0.5,
    },
  },
}

// Slide Up (no scale) - Slow (smoother settle)
export const springSlideUpSlow: Variants = {
  hidden: {
    opacity: 0,
    y: 40,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 30,
      mass: 0.8,
    },
  },
}

// Slide Left (no scale) - Fast
export const springSlideLeft: Variants = {
  hidden: {
    opacity: 0,
    x: -80,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
      mass: 0.5,
    },
  },
}

// Slide Left (no scale) - Slow (smoother settle)
export const springSlideLeftSlow: Variants = {
  hidden: {
    opacity: 0,
    x: -80,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 30,
      mass: 0.8,
    },
  },
}

// Slide Right (no scale) - Fast
export const springSlideRight: Variants = {
  hidden: {
    opacity: 0,
    x: 80,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
      mass: 0.5,
    },
  },
}

// Slide Right (no scale) - Slow (smoother settle)
export const springSlideRightSlow: Variants = {
  hidden: {
    opacity: 0,
    x: 80,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 30,
      mass: 0.8,
    },
  },
}

// Legacy alias for backward compatibility
export const springScaleIn = springZoomIn

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: STAGGER.normal,
    },
  },
}

export const pageExit: Variants = {
  exit: {
    opacity: 0,
    transition: transitions.fast,
  },
}

// Export all variants as a collection
export const variants = {
  fadeIn,
  fadeInUp,
  fadeInDown,
  fadeInLeft,
  fadeInRight,
  scaleIn,
  springZoomIn,
  springZoomInSlow,
  springSlideUp,
  springSlideUpSlow,
  springSlideLeft,
  springSlideLeftSlow,
  springSlideRight,
  springSlideRightSlow,
  springScaleIn, // legacy alias
  staggerContainer,
  pageExit,
} as const

export type VariantName = keyof typeof variants
