'use client'

import { AppChrome } from '../app-chrome/app-chrome'
import { MissingKeyProvider, Toaster } from '#/components'
import { useRouteMemory } from '#/lib/use-route-memory'

// The client half of the dashboard layout: the chrome that needs hooks.
export function AppShell({ children }: { children: React.ReactNode }) {
  useRouteMemory()

  return (
    <MissingKeyProvider>
      <AppChrome>{children}</AppChrome>
      {/* Every `toast(...)` in the app renders here. It lives inside
          MissingKeyProvider because that provider's error fallback is one of
          the callers. */}
      <Toaster />
    </MissingKeyProvider>
  )
}
