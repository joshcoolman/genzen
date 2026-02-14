/**
 * Reusable transition configurations
 * Presets for common animation transition types
 */

import { Transition } from 'framer-motion'
import { DURATION, EASING } from './constants'

export const transitions = {
  smooth: {
    duration: DURATION.normal,
    ease: EASING.smooth,
  } as Transition,

  spring: {
    type: 'spring',
    stiffness: 260,
    damping: 20,
  } as Transition,

  bounce: {
    type: 'spring',
    stiffness: 400,
    damping: 10,
  } as Transition,

  dramatic: {
    duration: DURATION.slowest,
    ease: EASING.easeOut,
  } as Transition,

  fast: {
    duration: DURATION.fast,
    ease: EASING.easeOut,
  } as Transition,

  slow: {
    duration: DURATION.slow,
    ease: EASING.smooth,
  } as Transition,
} as const

export type TransitionPreset = keyof typeof transitions
