'use client'

import { useEffect } from 'react'
import { usePersistedState } from '#/lib/use-persisted-state'
import { useIsMobile } from '#/lib/use-is-mobile'

interface Prefs {
  sortAsc: boolean
  showInfo: boolean
  thumbZoom: number
}

const PREFS_KEY = 'genzen:ai-images-prefs'

const DEFAULTS: Prefs = {
  sortAsc: false,
  showInfo: true,
  thumbZoom: 1,
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
const ZOOM_STOPS = [0.5, 0.6, 0.75, 1] as const

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
  /** A true zoom on the grid, one of `ZOOM_STOPS`. See `image-gallery`. */
  thumbZoom: number
  isMobile: boolean
  toggleSort: () => void
  toggleInfo: () => void
  zoomThumbs: (direction: 1 | -1) => void
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

  const isMobile = useIsMobile()

  // `thumbZoom` is not `thumbSize` coming back. That was three named sizes,
  // each with its own card treatment, behind a dropdown; this is one multiplier
  // driven from the keyboard with no control on screen, and every size looks
  // like the same gallery because nothing about the card changes (#284).
  //
  // `thumbSize` was stored here until #284 and `originFilter` until #348.
  // Purged on mount rather than on the next write, because someone who never
  // touches sort or captions again would otherwise keep stored settings nothing
  // reads -- and a stored scope nothing renders is worse than dead weight: it
  // would apply with no control on screen to undo it.
  useEffect(() => {
    store({})
  }, [])

  return {
    sortAsc,
    showInfo,
    thumbZoom,
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
    resetThumbZoom: () =>
      setThumbZoom(() => {
        store({ thumbZoom: DEFAULTS.thumbZoom })
        return DEFAULTS.thumbZoom
      }),
  }
}
