'use client'

import { AppChrome } from '../app-chrome/app-chrome'
import { RailOverrideProvider } from '../sidebar/rail-override'
import { MissingKeyProvider, Toaster } from '#/components'
import { useRouteMemory } from '#/lib/use-route-memory'

// The client half of the dashboard layout: the chrome that needs hooks.
export function AppShell({ children }: { children: React.ReactNode }) {
  useRouteMemory()

  return (
    <MissingKeyProvider>
      {/* The rail and the routes are on opposite sides of the chrome, so a
          route that wants to take the rail over needs a seam rather than a
          prop. */}
      <RailOverrideProvider>
        <AppChrome>{children}</AppChrome>
      </RailOverrideProvider>
      {/* Cmd-F, from any surface (#213). Mounted here because "from anywhere"
          is the feature -- a per-route copy would be four copies and a fifth
          route where it silently does not exist. */}
      {/* Every `toast(...)` in the app renders here. It lives inside
          MissingKeyProvider because that provider's error fallback is one of
          the callers. */}
      <Toaster />
    </MissingKeyProvider>
  )
}
