'use client'

import { useEffect } from 'react'
import { usePersistedState } from '#/lib/use-persisted-state'
import { useIsMobile } from '#/lib/use-is-mobile'

/**
 * What the grid is scoped to (#444).
 *
 * Removed in #348 on the grounds that a group is the only scope worth having,
 * and brought back because one question a group cannot answer kept coming up:
 * **"show me my uploads"** -- wherever they happen to sit. The workaround was
 * making a group called Uploads by hand, which decays the moment you upload
 * again, because new uploads land loose.
 *
 * `canvas` is commented rather than deleted: it is a real `origin` value, and
 * a stored pref from before #348 may still name it, which is why the type
 * keeps it.
 */
export const ORIGIN_FILTERS = [
  'all',
  'images',
  'uploads',
  // 'canvas',
] as const satisfies ReadonlyArray<OriginFilter>

export type OriginFilter = 'images' | 'uploads' | 'canvas' | 'all'

export const ORIGIN_FILTER_LABELS: Record<OriginFilter, string> = {
  all: 'All',
  images: 'Generations',
  uploads: 'Uploads',
  canvas: 'Canvas',
}

interface Prefs {
  sortAsc: boolean
  showInfo: boolean
  thumbZoom: number
  originFilter: OriginFilter
}

const PREFS_KEY = 'genzen:ai-images-prefs'

const DEFAULTS: Prefs = {
  sortAsc: false,
  showInfo: true,
  thumbZoom: 1,
  // **All**, not generations as it was before #348. Working with everything
  // together is the normal state; the scope is for the moment you go looking
  // for one upload, not the state you live in.
  originFilter: 'all',
}

/**
 * The zoom stops, found by walking the range with a readout rather than picked
 * (#403).
 *
 * Not an even percentage, because an even one does not work: the grid is
 * `auto-fill` over a 200px minimum, so a step only reads as a change when it
 * crosses a column-count threshold, and those are not evenly spaced. At 10%
 * the first three stops all resolved to four columns and two of them did
 * nothing visible.
 *
 * These are the four that each move the count. They are tuned to a real
 * layout, so a wildly different window width would want different ones -- the
 * alternative was computing them from the measured width on every keypress,
 * which is a lot of machinery for a gallery one person looks at.
 *
 * Ascending. `zoomThumbs` walks the array, so nothing here has to be a step
 * size or divide evenly.
 */
export const ZOOM_STOPS = [0.5, 0.6, 0.75, 1] as const

/** The nearest stop to an arbitrary number -- so a value stored before this
 *  list existed lands on the list rather than sitting between two of them. */
function nearestStop(z: number): number {
  return ZOOM_STOPS.reduce((best, stop) =>
    Math.abs(stop - z) < Math.abs(best - z) ? stop : best,
  )
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
        thumbZoom: nearestStop(stored.thumbZoom ?? DEFAULTS.thumbZoom),
        originFilter: isOriginFilter(stored.originFilter)
          ? stored.originFilter
          : DEFAULTS.originFilter,
      }
    }
  } catch {
    // ignore
  }
  return DEFAULTS
}

/** A stored value only counts if the control can still show it -- `canvas` is
 *  a legal `OriginFilter` with no pill, so a pref naming it would scope the
 *  grid with nothing on screen to undo it. */
function isOriginFilter(value: unknown): value is OriginFilter {
  return ORIGIN_FILTERS.includes(value as (typeof ORIGIN_FILTERS)[number])
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
  /** What the grid is scoped to, top level only (#444). */
  originFilter: OriginFilter
  setOriginFilter: (filter: OriginFilter) => void
  /** Widen to `all` when something just made would land outside the scope --
   *  making a thing is an implicit request to see it. Only ever widens. */
  revealAll: () => void
  /** A true zoom on the grid, one of `ZOOM_STOPS`. See `image-gallery`. */
  thumbZoom: number
  isMobile: boolean
  toggleSort: () => void
  toggleInfo: () => void
  zoomThumbs: (direction: 1 | -1) => void
  /** Straight to a stop, for the toolbar menu. The keyboard walks instead. */
  setThumbZoom: (zoom: number) => void
  resetThumbZoom: () => void
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

  const [thumbZoom, setThumbZoom] = usePersistedState(
    () => read().thumbZoom,
    DEFAULTS.thumbZoom,
  )

  const [originFilter, setOriginFilterState] = usePersistedState(
    () => read().originFilter,
    DEFAULTS.originFilter,
  )

  const isMobile = useIsMobile()

  // `thumbZoom` is not `thumbSize` coming back. That was three named sizes,
  // each with its own card treatment, behind a dropdown; this is one multiplier
  // driven from the keyboard with no control on screen, and every size looks
  // like the same gallery because nothing about the card changes (#284).
  //
  // `thumbSize` was stored here until #284, and `originFilter` was purged the
  // same way between #348 and #444 -- it is back, and `isOriginFilter` above is
  // what keeps the old lesson: a stored scope the control cannot show is worse
  // than dead weight, because it would apply with nothing on screen to undo
  // it. Purged on mount rather than on the next write, since someone who never
  // touches sort or captions again would otherwise keep settings nothing
  // reads.
  useEffect(() => {
    store({})
  }, [])

  return {
    sortAsc,
    showInfo,
    thumbZoom,
    originFilter,
    setOriginFilter: (filter: OriginFilter) => {
      store({ originFilter: filter })
      setOriginFilterState(filter)
    },
    // Widens to `all` rather than switching to the matching scope, which is
    // what the pre-#348 `reveal()` did. Switching hides whatever you were
    // looking at to show the new thing; widening only ever adds.
    revealAll: () => {
      setOriginFilterState((current) => {
        if (current === 'all') return current
        store({ originFilter: 'all' })
        return 'all'
      })
    },
    isMobile,
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
    zoomThumbs: (direction) =>
      setThumbZoom((v) => {
        const i = ZOOM_STOPS.indexOf(
          nearestStop(v) as (typeof ZOOM_STOPS)[number],
        )
        const next =
          ZOOM_STOPS[
            Math.min(ZOOM_STOPS.length - 1, Math.max(0, i + direction))
          ]
        store({ thumbZoom: next })
        return next
      }),
    setThumbZoom: (zoom) =>
      setThumbZoom(() => {
        const next = nearestStop(zoom)
        store({ thumbZoom: next })
        return next
      }),
    resetThumbZoom: () =>
      setThumbZoom(() => {
        store({ thumbZoom: DEFAULTS.thumbZoom })
        return DEFAULTS.thumbZoom
      }),
  }
}
