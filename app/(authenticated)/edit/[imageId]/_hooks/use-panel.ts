'use client'

import { useEffect } from 'react'
import { usePersistedState } from '#/lib/use-persisted-state'

const PINNED_KEY = 'genzen:edit-panel-pinned'
const OPEN_KEY = 'genzen:edit-panel-open'

export interface PanelState {
  open: boolean
  setOpen: (open: boolean) => void
  pinned: boolean
  togglePinned: () => void
}

/** Two independent booleans, each its own localStorage key so the pair survives
 *  a reload separately -- pinned decides whether the dock pushes the page,
 *  open decides whether it is there at all. */
export function usePanel(): PanelState {
  const [pinned, setPinned, pinnedHydrated] = usePersistedState(
    () => localStorage.getItem(PINNED_KEY) !== 'false',
    true,
  )

  useEffect(() => {
    if (!pinnedHydrated) return
    localStorage.setItem(PINNED_KEY, String(pinned))
  }, [pinned, pinnedHydrated])

  const [open, setOpen, openHydrated] = usePersistedState(
    () => localStorage.getItem(OPEN_KEY) !== 'false',
    true,
  )

  useEffect(() => {
    if (!openHydrated) return
    localStorage.setItem(OPEN_KEY, String(open))
  }, [open, openHydrated])

  return {
    open,
    setOpen,
    pinned,
    togglePinned: () => setPinned((p) => !p),
  }
}
