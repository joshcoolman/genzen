'use client'

import { usePersistedState } from '#/lib/use-persisted-state'
import { useIsMobile } from '#/lib/hooks/use-is-mobile'

export const THUMB_SIZES = ['lg', 'md', 'sm'] as const

export type ThumbSize = (typeof THUMB_SIZES)[number]

export const THUMB_LABELS: Record<ThumbSize, string> = {
  lg: 'LG',
  md: 'MD',
  sm: 'SM',
}

interface Prefs {
  thumbSize: ThumbSize
  sortAsc: boolean
  showInfo: boolean
}

const PREFS_KEY = 'genzen:ai-images-prefs'

const DEFAULTS: Prefs = {
  thumbSize: 'lg',
  sortAsc: false,
  showInfo: true,
}

// Only ever called from an effect, never during render -- see usePersistedState.
function read(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    // ignore
  }
  return DEFAULTS
}

function store(partial: Partial<Prefs>) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...read(), ...partial }))
  } catch {
    // ignore
  }
}

export interface PrefsState {
  thumbSize: ThumbSize
  /** What the gallery renders: mobile is too narrow for anything but `lg`. */
  effectiveThumbSize: ThumbSize
  sortAsc: boolean
  showInfo: boolean
  isMobile: boolean
  cycleThumbSize: () => void
  toggleSort: () => void
  toggleInfo: () => void
}

/**
 * The three gallery view preferences, persisted under one key.
 *
 * Each setter writes through to storage as it updates, which is why they are
 * here rather than in the toolbar: the toolbar renders them, it does not own
 * them, and the gallery needs them too.
 */
export function usePrefs(): PrefsState {
  const [thumbSize, setThumbSize] = usePersistedState<ThumbSize>(
    () => read().thumbSize,
    DEFAULTS.thumbSize,
  )
  const [sortAsc, setSortAsc] = usePersistedState(
    () => read().sortAsc,
    DEFAULTS.sortAsc,
  )
  const [showInfo, setShowInfo] = usePersistedState(
    () => read().showInfo,
    DEFAULTS.showInfo,
  )

  const isMobile = useIsMobile()

  return {
    thumbSize,
    effectiveThumbSize: isMobile ? 'lg' : thumbSize,
    sortAsc,
    showInfo,
    isMobile,
    cycleThumbSize: () =>
      setThumbSize((v) => {
        const next =
          THUMB_SIZES[(THUMB_SIZES.indexOf(v) + 1) % THUMB_SIZES.length]
        store({ thumbSize: next })
        return next
      }),
    toggleSort: () =>
      setSortAsc((v) => {
        store({ sortAsc: !v })
        return !v
      }),
    toggleInfo: () =>
      setShowInfo((v) => {
        store({ showInfo: !v })
        return !v
      }),
  }
}
