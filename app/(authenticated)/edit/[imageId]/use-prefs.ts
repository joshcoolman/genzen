'use client'

import { usePersistedState } from '#/lib/use-persisted-state'

export const THUMB_SIZES = ['lg', 'md', 'sm'] as const

export type ThumbSize = (typeof THUMB_SIZES)[number]

export const THUMB_LABELS: Record<ThumbSize, string> = {
  lg: 'LG',
  md: 'MD',
  sm: 'SM',
}

interface Prefs {
  thumbSize: ThumbSize
  showInfo: boolean
  sortAsc: boolean
}

const KEY = 'genzen:edit-page-prefs'

const DEFAULTS: Prefs = {
  thumbSize: 'lg',
  showInfo: true,
  sortAsc: false,
}

// Only ever called from an effect, never during render -- see usePersistedState.
function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {}
  return DEFAULTS
}

function write(partial: Partial<Prefs>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), ...partial }))
  } catch {}
}

export interface PrefsState extends Prefs {
  toggleThumbSize: () => void
  toggleInfo: () => void
  toggleSort: () => void
}

/** The three view controls in the toolbar, mirrored from the Images route and
 *  persisted under one key. */
export function usePrefs(): PrefsState {
  const [thumbSize, setThumbSize] = usePersistedState<ThumbSize>(
    () => read().thumbSize,
    DEFAULTS.thumbSize,
  )
  const [showInfo, setShowInfo] = usePersistedState(
    () => read().showInfo,
    DEFAULTS.showInfo,
  )
  const [sortAsc, setSortAsc] = usePersistedState(
    () => read().sortAsc,
    DEFAULTS.sortAsc,
  )

  return {
    thumbSize,
    showInfo,
    sortAsc,
    toggleThumbSize: () =>
      setThumbSize((v) => {
        const next =
          THUMB_SIZES[(THUMB_SIZES.indexOf(v) + 1) % THUMB_SIZES.length]
        write({ thumbSize: next })
        return next
      }),
    toggleInfo: () =>
      setShowInfo((v) => {
        write({ showInfo: !v })
        return !v
      }),
    toggleSort: () =>
      setSortAsc((v) => {
        write({ sortAsc: !v })
        return !v
      }),
  }
}
