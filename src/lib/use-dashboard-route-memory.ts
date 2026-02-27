import { useEffect } from 'react'
import { useLocation } from '@tanstack/react-router'

/**
 * Hook to remember the last visited dashboard route.
 * Call this in the dashboard layout to track route changes.
 */
export function useDashboardRouteMemory() {
  const location = useLocation()

  useEffect(() => {
    // Only track dashboard sub-routes, not the index
    if (
      location.pathname.startsWith('/dashboard') &&
      location.pathname !== '/dashboard' &&
      location.pathname !== '/dashboard/'
    ) {
      localStorage.setItem('genzen:last-dashboard-route', location.pathname)
    }
  }, [location.pathname])
}
