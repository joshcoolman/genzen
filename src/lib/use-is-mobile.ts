'use client'

import { useCallback, useSyncExternalStore } from 'react'

const MOBILE_BREAKPOINT = 400 // matches --breakpoint-xs

/**
 * Hook to detect if the viewport is mobile-sized
 * @param breakpoint - Width in pixels to consider mobile (default: 400)
 * @returns boolean indicating if viewport is below breakpoint
 */
export function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const query = `(max-width: ${breakpoint - 1}px)`
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )
  // False while hydrating (reading the width then was a mismatch), but correct
  // on the first render of anything mounted after. A useState(false) + effect
  // rendered every late mount as desktop for one commit: the image viewer's
  // desktop lightbox locked the body in that commit, and the phone Dialog's
  // scroll lock recorded it as the original and restored it on close,
  // freezing the page.
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Where the app chrome swaps its rail for the phone's corner menu: `48rem`
 *  in `app-chrome.module.css`. */
const PHONE_BREAKPOINT = 768 // --breakpoint-md

/**
 * The phone layout (#753, #755): corner menu, floating plus, composer sheets,
 * 2-up walls. **One width for all of it**, the chrome's. The trial used this
 * file's 400px default, which left anything between -- a Pro Max is 430px --
 * with the phone's nav over the desktop's generator and wall.
 */
export function usePhoneLayout() {
  return useIsMobile(PHONE_BREAKPOINT)
}
