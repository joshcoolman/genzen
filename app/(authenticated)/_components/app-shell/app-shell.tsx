'use client'

import { AppChrome } from '../app-chrome/app-chrome'
import { RunOverlayProvider } from '../run-overlay/run-overlay-provider'
import { MissingKeyProvider, Toaster } from '#/components'
import { useRouteMemory } from '#/lib/use-route-memory'

// The client half of the dashboard layout: the chrome that needs hooks.
export function AppShell({ children }: { children: React.ReactNode }) {
  useRouteMemory()

  return (
    <MissingKeyProvider>
      {/* Above every route, so a long job's progress survives navigation
          (#725). */}
      <RunOverlayProvider>
        <AppChrome>{children}</AppChrome>
      </RunOverlayProvider>
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
