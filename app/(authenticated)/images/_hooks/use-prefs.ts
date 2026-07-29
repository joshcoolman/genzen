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

/**
 * What the gallery is scoped to. `images` is the default because Images is
 * primarily where you generate; the library itself is exhaustive and nothing is
 * ever exiled from it (#212).
 *
 * This scopes *browsing while working* -- it is not how you find things. That
 * is #213, an overlay, because the cost of "go somewhere to look" lives in the
 * navigation and no filter can fix it. If #213 lands and this stops being
 * touched, deleting it is the right outcome.
 */
export const ORIGIN_FILTERS = ['images', 'uploads', 'canvas', 'all'] as const

export type OriginFilter = (typeof ORIGIN_FILTERS)[number]

export const ORIGIN_FILTER_LABELS: Record<OriginFilter, string> = {
  images: 'Generations',
  uploads: 'Uploads',
  canvas: 'Canvas',
  all: 'All',
}

interface Prefs {
  thumbSize: ThumbSize
  sortAsc: boolean
  showInfo: boolean
  originFilter: OriginFilter
}

const PREFS_KEY = 'genzen:ai-images-prefs'

const DEFAULTS: Prefs = {
  thumbSize: 'lg',
  sortAsc: false,
  showInfo: true,
  originFilter: 'images',
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
  originFilter: OriginFilter
  isMobile: boolean
  cycleThumbSize: () => void
  toggleSort: () => void
  toggleInfo: () => void
  setOriginFilter: (filter: OriginFilter) => void
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

  const [originFilter, setOriginFilterRaw] = usePersistedState<OriginFilter>(
    () => read().originFilter,
    DEFAULTS.originFilter,
  )

  const isMobile = useIsMobile()

  return {
    thumbSize,
    effectiveThumbSize: isMobile ? 'lg' : thumbSize,
    sortAsc,
    showInfo,
    originFilter,
    isMobile,
    setOriginFilter: (filter: OriginFilter) => {
      store({ originFilter: filter })
      setOriginFilterRaw(filter)
    },
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
