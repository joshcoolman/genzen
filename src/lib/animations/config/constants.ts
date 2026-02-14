/**
 * Animation timing constants
 * Centralized values for consistent animation durations and delays
 */

export const DURATION = {
  instant: 0,
  fast: 0.2,
  normal: 0.4,
  slow: 0.6,
  slower: 0.8,
  slowest: 1.0,
} as const

export const STAGGER = {
  tight: 0.05,
  normal: 0.1,
  relaxed: 0.15,
  loose: 0.2,
} as const

export const SCROLL_THRESHOLD = {
  immediate: 0,
  quarter: 0.25,
  half: 0.5,
  full: 1.0,
} as const

export const EASING = {
  // Custom cubic-bezier curves for smooth motion
  smooth: [0.43, 0.13, 0.23, 0.96],
  easeOut: [0.33, 1, 0.68, 1],
  easeIn: [0.32, 0, 0.67, 0],
  easeInOut: [0.65, 0, 0.35, 1],
} as const
