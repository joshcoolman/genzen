'use client'

/**
 * Hook for coordinating page entrance/exit animations
 * Manages state for page transitions during navigation
 */

import { useState, useCallback } from 'react'

export interface UsePageTransitionReturn {
  /** Whether the page is currently exiting */
  isExiting: boolean
  /** Function to trigger exit animation */
  startExit: () => void
  /** Function to reset exit state */
  resetExit: () => void
}

export function usePageTransition(): UsePageTransitionReturn {
  const [isExiting, setIsExiting] = useState(false)

  const startExit = useCallback(() => {
    setIsExiting(true)
  }, [])

  const resetExit = useCallback(() => {
    setIsExiting(false)
  }, [])

  return {
    isExiting,
    startExit,
    resetExit,
  }
}
