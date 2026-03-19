import { useEffect } from 'react'
import { useCredits } from './use-credits'

/**
 * Drop-in replacement for useCredits() that auto-shows the insufficient
 * credits dialog when the user's balance is too low for the given cost.
 * Use on any route where generation requires credits.
 */
export function useRequireCredits(cost: number) {
  const credits = useCredits()

  useEffect(() => {
    if (credits.isEmpty) {
      credits.showInsufficientCredits(cost)
    }
  }, [credits.isEmpty])

  return credits
}
