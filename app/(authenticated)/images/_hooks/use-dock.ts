'use client'

import { useEffect } from 'react'
import { usePersistedState } from '#/lib/use-persisted-state'

const OPEN_KEY = 'genzen:generator-panel-open'

export interface DockState {
  open: boolean
  setOpen: (open: boolean) => void
}

/**
 * Whether the generator is showing.
 *
 * It used to also hold whether the panel was pinned or floating. Floating never
 * paid for itself: it bought back 20rem of gallery while covering the
 * right-hand column of thumbnails, so the images it revealed were the ones it
 * hid. It also cost a dismiss layer, a shadow, and the toolbar's `.inset`
 * padding (#207), which existed solely so the tools were not underneath it.
 *
 * The write-through effect waits on `hydrated` or it would put the fallback
 * over the stored value on mount and reset the panel on every load.
 */
export function useDock(): DockState {
  const [open, setOpen, openHydrated] = usePersistedState(
    () => localStorage.getItem(OPEN_KEY) !== 'false',
    true,
  )

  useEffect(() => {
    if (!openHydrated) return
    localStorage.setItem(OPEN_KEY, String(open))
  }, [open, openHydrated])

  return { open, setOpen }
}
