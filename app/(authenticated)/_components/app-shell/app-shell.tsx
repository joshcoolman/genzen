'use client'

import { AppChrome } from '../app-chrome/app-chrome'
import { SpotlightNav } from '../spotlight-nav/spotlight-nav'
import { MissingKeyProvider, Toaster } from '#/components'
import { useRouteMemory } from '#/lib/use-route-memory'

// The client half of the dashboard layout: the chrome that needs hooks.
// Spotlight moves here from the old __root route -- it is only reachable once
// signed in, and the root layout is now a Server Component.
export function AppShell({ children }: { children: React.ReactNode }) {
  useRouteMemory()

  return (
    <MissingKeyProvider>
      <SpotlightNav />
      <AppChrome>{children}</AppChrome>
      {/* Every `toast(...)` in the app renders here. It lives inside
          MissingKeyProvider because that provider's error fallback is one of
          the callers. */}
      <Toaster />
    </MissingKeyProvider>
  )
}
