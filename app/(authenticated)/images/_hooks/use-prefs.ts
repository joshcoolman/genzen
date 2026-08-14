'use client'

import { useEffect } from 'react'
import { usePersistedState } from '#/lib/use-persisted-state'
import { useIsMobile } from '#/lib/use-is-mobile'

interface Prefs {
  sortAsc: boolean
  showInfo: boolean
}

const PREFS_KEY = 'genzen:ai-images-prefs'

const DEFAULTS: Prefs = {
  sortAsc: false,
  showInfo: true,
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
  isMobile: boolean
  toggleSort: () => void
  toggleInfo: () => void
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

  const isMobile = useIsMobile()

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
  }
}
