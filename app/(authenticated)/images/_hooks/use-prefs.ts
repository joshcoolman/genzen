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

/** One step, and the range it moves in. Browser zoom's own step, because the
 *  gesture is a copy of browser zoom and a different one would feel wrong next
 *  to it. */
const ZOOM_STEP = 0.1
const ZOOM_MIN = 0.5
const ZOOM_MAX = 1.5

/** Steps are floats, and 1 - 0.1 - 0.1 is 0.7999999999999999 without this. */
const clampZoom = (z: number) =>
  Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) * 10) / 10

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
        thumbZoom: clampZoom(stored.thumbZoom ?? DEFAULTS.thumbZoom),
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
  /** A true zoom on the grid, 0.5 to 1.5. See `image-gallery`. */
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
        const next = clampZoom(v + direction * ZOOM_STEP)
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
