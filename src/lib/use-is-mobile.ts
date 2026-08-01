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
