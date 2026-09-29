'use client'

import { useEffect, useState } from 'react'

const MOBILE_BREAKPOINT = 400 // matches --breakpoint-xs

/**
 * Hook to detect if the viewport is mobile-sized
 * @param breakpoint - Width in pixels to consider mobile (default: 400)
 * @returns boolean indicating if viewport is below breakpoint
 */
export function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  // Always false for the first render, on both server and client -- reading
  // window.innerWidth here made a narrow viewport a hydration mismatch. The
  // effect below corrects it before paint.
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    setIsMobile(mql.matches)
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [breakpoint])

  return isMobile
}

/** Where the app chrome swaps its rail for the phone's bottom nav: `48rem`
 *  in `app-chrome.module.css`. */
const PHONE_BREAKPOINT = 768 // --breakpoint-md

/**
 * The phone layout (#753, #755): bottom nav, floating plus, composer sheets,
 * 2-up walls. **One width for all of it**, the chrome's. The trial used this
 * file's 400px default, which left anything between -- a Pro Max is 430px --
 * with the phone's nav over the desktop's generator and wall.
 */
export function usePhoneLayout() {
  return useIsMobile(PHONE_BREAKPOINT)
}
