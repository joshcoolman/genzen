'use client'

import { useEffect } from 'react'
import { usePersistedState } from '#/lib/use-persisted-state'

const OPEN_KEY = 'genzen:generator-panel-open'
const PINNED_KEY = 'genzen:generator-panel-pinned'

export interface DockState {
  open: boolean
  /** Pinned pushes the gallery over; unpinned floats above it with a dismiss layer. */
  pinned: boolean
  setOpen: (open: boolean) => void
  togglePinned: () => void
}

/**
 * Whether the generator is showing, and whether it is docked or floating.
 *
 * Two keys rather than one because they predate each other; the write-through
 * effects wait on `hydrated` or they would put the fallback over the stored
 * value on mount and reset the panel on every load.
 */
export function useDock(): DockState {
  const [open, setOpen, openHydrated] = usePersistedState(
    () => localStorage.getItem(OPEN_KEY) !== 'false',
    true,
  )

  const [pinned, setPinned, pinnedHydrated] = usePersistedState(
    () => localStorage.getItem(PINNED_KEY) !== 'false',
    true,
  )

  useEffect(() => {
    if (!openHydrated) return
    localStorage.setItem(OPEN_KEY, String(open))
  }, [open, openHydrated])

  useEffect(() => {
    if (!pinnedHydrated) return
    localStorage.setItem(PINNED_KEY, String(pinned))
  }, [pinned, pinnedHydrated])

  return {
    open,
    pinned,
    setOpen,
    togglePinned: () => setPinned((p) => !p),
  }
}
