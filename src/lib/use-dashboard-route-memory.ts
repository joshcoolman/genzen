'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Hook to remember the last visited dashboard route.
 * Call this in the dashboard layout to track route changes.
 */
export function useDashboardRouteMemory() {
  const pathname = usePathname()

  useEffect(() => {
    // Only track dashboard sub-routes, not the index
    if (
      pathname.startsWith('/dashboard') &&
      pathname !== '/dashboard' &&
      pathname !== '/dashboard/'
    ) {
      localStorage.setItem('genzen:last-dashboard-route', pathname)
    }
  }, [pathname])
}
