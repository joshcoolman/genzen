import { useEffect } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'

const LAST_DASHBOARD_ROUTE_KEY = 'genzen:last-dashboard-route'

/**
 * Hook to remember and restore the last visited dashboard route.
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
      localStorage.setItem(LAST_DASHBOARD_ROUTE_KEY, location.pathname)
    }
  }, [location.pathname])
}

/**
 * Hook to restore the last visited dashboard route.
 * Call this on the dashboard index page to redirect to the last visited route.
 */
export function useRestoreDashboardRoute() {
  const navigate = useNavigate()

  useEffect(() => {
    const lastRoute = localStorage.getItem(LAST_DASHBOARD_ROUTE_KEY)
    if (
      lastRoute &&
      lastRoute !== '/dashboard' &&
      lastRoute !== '/dashboard/'
    ) {
      // Navigate to the last visited route
      navigate({ to: lastRoute as any, replace: true })
    }
  }, [navigate])
}
