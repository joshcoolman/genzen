'use client'

import { AppChrome } from '../app-chrome/app-chrome'
import { ScreenshotProbe } from '../screenshot-probe/screenshot-probe'
import { MissingKeyProvider, Toaster } from '#/components'
import { useRouteMemory } from '#/lib/use-route-memory'

// The client half of the dashboard layout: the chrome that needs hooks.
export function AppShell({ children }: { children: React.ReactNode }) {
  useRouteMemory()

  return (
    <MissingKeyProvider>
      <AppChrome>{children}</AppChrome>
      {/* Cmd-F, from any surface (#213). Mounted here because "from anywhere"
          is the feature -- a per-route copy would be four copies and a fifth
          route where it silently does not exist. */}
      {/* Every `toast(...)` in the app renders here. It lives inside
          MissingKeyProvider because that provider's error fallback is one of
          the callers. */}
      <Toaster />
      {/* Spike (#506): can the app draw a picture of itself worth sending to a
          model? Mounted here for the same reason Cmd-F is -- the question is
          about whichever route you are standing on. Saves nothing. */}
      <ScreenshotProbe />
    </MissingKeyProvider>
  )
}
