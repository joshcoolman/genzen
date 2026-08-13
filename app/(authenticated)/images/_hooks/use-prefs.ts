'use client'

import { useEffect } from 'react'
import { usePersistedState } from '#/lib/use-persisted-state'
import { useIsMobile } from '#/lib/use-is-mobile'

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
/**
 * The pills the toolbar renders.
 *
 * **`canvas` is temporarily removed at Josh's request (#319).** Scoping the
 * library to things made on the canvas turned out not to be something worth
 * a pill once groups existed. It is commented out rather than deleted because
 * the removal is a trial, not a decision -- put the entry back and the pill
 * returns; nothing else knows the difference. `'canvas'` stays in
 * `OriginFilter` and in `ORIGIN_FILTER_LABELS` for the same reason, and
 * because a stored pref from before this change still names it.
 */
export const ORIGIN_FILTERS = [
  'images',
  'uploads',
  // 'canvas',
  'all',
] as const satisfies ReadonlyArray<OriginFilter>

export type OriginFilter = 'images' | 'uploads' | 'canvas' | 'all'

export const ORIGIN_FILTER_LABELS: Record<OriginFilter, string> = {
  images: 'Generations',
  uploads: 'Uploads',
  canvas: 'Canvas',
  all: 'All',
}

interface Prefs {
  sortAsc: boolean
  showInfo: boolean
  originFilter: OriginFilter
}

const PREFS_KEY = 'genzen:ai-images-prefs'

const DEFAULTS: Prefs = {
  sortAsc: false,
  showInfo: true,
  originFilter: 'images',
}

// Only ever called from an effect, never during render -- see usePersistedState.
//
// Reading picks fields out rather than spreading, so a key nothing reads any
// more (`thumbSize`, #284) is dropped on the next write instead of living on in
// storage as a setting that appears to exist.
function read(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) {
      const stored = JSON.parse(raw) as Partial<Prefs>
      return {
        sortAsc: stored.sortAsc ?? DEFAULTS.sortAsc,
        showInfo: stored.showInfo ?? DEFAULTS.showInfo,
        // A stored filter whose pill no longer renders is a trap: the scope
        // applies, no pill reads as active, and there is nothing to click to
        // get out of it. Anything not in `ORIGIN_FILTERS` falls back -- which
        // today means the commented-out `canvas`, and tomorrow means whatever
        // else is retired without anyone remembering this line.
        originFilter:
          stored.originFilter &&
          (ORIGIN_FILTERS as ReadonlyArray<OriginFilter>).includes(
            stored.originFilter,
          )
            ? stored.originFilter
            : DEFAULTS.originFilter,
      }
    }
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
  sortAsc: boolean
  showInfo: boolean
  originFilter: OriginFilter
  isMobile: boolean
  toggleSort: () => void
  toggleInfo: () => void
  setOriginFilter: (filter: OriginFilter) => void
}

/**
 * The gallery view preferences, persisted under one key.
 *
 * Each setter writes through to storage as it updates, which is why they are
 * here rather than in the toolbar: the toolbar renders them, it does not own
 * them, and the gallery needs them too.
 */
export function usePrefs(): PrefsState {
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

  // `thumbSize` was stored here until #284. Purged on mount rather than on the
  // next write, because someone who never touches sort or scope again would
  // otherwise keep a stored setting nothing reads.
  useEffect(() => {
    store({})
  }, [])

  return {
    sortAsc,
    showInfo,
    originFilter,
    isMobile,
    setOriginFilter: (filter: OriginFilter) => {
      store({ originFilter: filter })
      setOriginFilterRaw(filter)
    },
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
