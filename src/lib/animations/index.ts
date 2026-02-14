/**
 * Animation system public exports
 * Provides reusable animation components, hooks, and configuration
 */

// Re-export motion from framer-motion for convenience
export { motion } from 'framer-motion'

// Components
export { FadeIn } from './components/fade-in'
export type { FadeInProps } from './components/fade-in'

export { StaggerContainer } from './components/stagger-container'
export type { StaggerContainerProps } from './components/stagger-container'

export { ScrollReveal } from './components/scroll-reveal'
export type { ScrollRevealProps } from './components/scroll-reveal'

export { AnimatedWrapper } from './components/animated-wrapper'
export type { AnimatedWrapperProps } from './components/animated-wrapper'

// Hooks
export { useScrollReveal } from './hooks/use-scroll-reveal'
export type { UseScrollRevealOptions } from './hooks/use-scroll-reveal'

export { useStaggerChildren } from './hooks/use-stagger-children'
export type { UseStaggerChildrenOptions } from './hooks/use-stagger-children'

export { usePageTransition } from './hooks/use-page-transition'
export type { UsePageTransitionReturn } from './hooks/use-page-transition'

// Config
export { DURATION, STAGGER, SCROLL_THRESHOLD, EASING } from './config/constants'

export { transitions } from './config/transitions'
export type { TransitionPreset } from './config/transitions'

export {
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
  variants,
} from './config/variants'
export type { VariantName } from './config/variants'
