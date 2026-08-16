'use client'

import { usePersistedState } from '#/lib/use-persisted-state'

interface CanvasPrefs {
  showModelLabels: boolean
}

const PREFS_KEY = 'genzen:canvas-prefs'

const DEFAULTS: CanvasPrefs = {
  // Off (#394). A board of thirty cards carried thirty pieces of floating text,
  // competing with the pictures on the one surface whose whole job is looking
  // at them. Which model made a card is a question you ask occasionally, not a
  // thing you need annotated permanently.
  showModelLabels: false,
}

// Only ever called from an effect, never during render -- see usePersistedState.
//
// Picks fields out rather than spreading, so a key nothing reads any more is
// dropped on the next write instead of living on in storage as a setting that
// appears to exist.
function read(): CanvasPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) {
      const stored = JSON.parse(raw) as Partial<CanvasPrefs>
      return {
        showModelLabels: stored.showModelLabels ?? DEFAULTS.showModelLabels,
      }
    }
  } catch {
    // ignore
  }
  return DEFAULTS
}

function store(partial: Partial<CanvasPrefs>) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...read(), ...partial }))
  } catch {
    // ignore
  }
}

export interface CanvasPrefsState {
  showModelLabels: boolean
  setShowModelLabels: (next: boolean) => void
}

/**
 * The canvas's display preferences, persisted under one key.
 *
 * A blob rather than a key per setting (which is how `video/use-view.ts` stores
 * its model) because this is explicitly the first of several: a key-per-setting
 * is a migration the day the second one lands.
 *
 * Per browser, not per canvas. Nothing here is user data -- it does not belong
 * in the `canvases` row and must not be saved with the arrangement.
 */
export function useCanvasPrefs(): CanvasPrefsState {
  const [showModelLabels, setShowModelLabels] = usePersistedState(
    () => read().showModelLabels,
    DEFAULTS.showModelLabels,
  )

  return {
    showModelLabels,
    setShowModelLabels: (next) => {
      store({ showModelLabels: next })
      setShowModelLabels(next)
    },
  }
}
