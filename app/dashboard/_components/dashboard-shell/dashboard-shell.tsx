'use client'

import { DashboardLayout } from '../dashboard-layout/dashboard-layout'
import { SpotlightNav } from '../spotlight-nav/spotlight-nav'
import { MissingKeyProvider } from '#/components/MissingKeyDialog'
import { useDashboardRouteMemory } from '#/lib/use-dashboard-route-memory'

// The client half of the dashboard layout: the chrome that needs hooks.
// Spotlight moves here from the old __root route -- it is only reachable once
// signed in, and the root layout is now a Server Component.
export function DashboardShell({ children }: { children: React.ReactNode }) {
  useDashboardRouteMemory()

  return (
    <MissingKeyProvider>
      <SpotlightNav />
      <DashboardLayout>{children}</DashboardLayout>
    </MissingKeyProvider>
  )
}
