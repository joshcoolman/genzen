'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

interface RailOverrideContext {
  override: ReactNode | null
  setOverride: (node: ReactNode | null) => void
}

const Ctx = createContext<RailOverrideContext | null>(null)

/**
 * Lets one route take over the sidebar rail for as long as it renders
 * `<RailOverride>`.
 *
 * The rail is chrome and the routes are below it, so there is no prop to pass:
 * this is the seam. It carries a `ReactNode` and nothing else -- the rail never
 * learns what a verb is, the same way `SelectionDrawer` takes `children`.
 */
export function RailOverrideProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<ReactNode | null>(null)
  const value = useMemo(() => ({ override, setOverride }), [override])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useRailOverride(): ReactNode | null {
  return useContext(Ctx)?.override ?? null
}

/**
 * Renders nothing where it sits; puts its children in the rail instead.
 *
 * A route renders it conditionally, so the takeover lasts exactly as long as
 * the condition -- select mode stays a selection rather than a second piece of
 * mode state (#325).
 */
export function RailOverride({ children }: { children: ReactNode }) {
  const ctx = useContext(Ctx)
  const setOverride = ctx?.setOverride

  useEffect(() => {
    if (!setOverride) return
    setOverride(children)
    return () => setOverride(null)
  }, [children, setOverride])

  return null
}
