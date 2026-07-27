'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Remembers the last route the user was actually on, for restoring on return.
 * Called from the shell, so it only ever sees signed-in routes -- `/` is skipped
 * because it is a redirect to /images, not a place.
 */
export function useRouteMemory() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname !== '/' && pathname !== '/login') {
      localStorage.setItem('genzen:last-route', pathname)
    }
  }, [pathname])
}
