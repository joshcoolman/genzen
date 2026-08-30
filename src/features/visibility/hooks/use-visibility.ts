'use client'

import { useCallback, useMemo, useState } from 'react'
import { setImagesHidden } from '../visibility.action'
import { toast } from '#/components'

/**
 * The whole of what this needs from a row.
 *
 * **Promoted out of `images/_hooks/` in #537**, when Video became the second
 * consumer -- the condition `docs/DELTAS.md` names, and the same one that
 * moved grouping here in #517. It took a `GalleryState` and read
 * `SavedAiImage` rows, neither of which a clip is, and neither of which it
 * ever needed: hiding is an id and a timestamp. A still satisfies this and so
 * does a `VideoRecord`, without either knowing about the other.
 */
export interface HideableRow {
  id: string
  hidden_at?: string | null
}

/**
 * What the grid is allowed to draw (#504).
 *
 * **A hidden image is never drawn in the grid.** The way to look at one is the
 * bar's tray, which lists them as thumbnails away from the wall -- not a
 * toggle that puts hidden rows back among the visible ones while still calling
 * them hidden. That was the first shape: the strip read "4 hidden" over four
 * visible pictures and needed a second verb to undo itself.
 *
 * **Hide and focus are one mechanism from opposite ends.** "Hide these eight"
 * and "show only these two" both produce a filtered view, so there is one
 * predicate with two inputs rather than two filters to keep in agreement.
 *
 * They differ in what they are for, which is why only one persists:
 *
 * - **Hidden is a decision.** It survives a refresh, because the noise you
 *   cleared away is still noise tomorrow. It is a column (`hidden_at`).
 * - **Focus is a glance.** Show me these two while I think about them. It dies
 *   with the page, because a spotlight left on yesterday is indistinguishable
 *   from a broken gallery.
 *
 * The count is the safety design, not the hiding. Hidden state that is not
 * visible is a slower kind of lost -- so the strip that says how many there
 * are is the part that has to be impossible to miss, and it is what makes
 * hiding a single click with no confirmation.
 */
export interface VisibilityState<T extends HideableRow> {
  /** True when this row should be drawn. */
  visible: (row: T) => boolean
  /** The ids being withheld, for surfaces that render images by id rather than
   *  by row -- a group card's swatches, the expanded member strip. */
  withheldIds: ReadonlySet<string>
  hiddenCount: number
  /** The spotlight, or null when there is none. */
  focusIds: ReadonlySet<string> | null
  focusOn: (ids: Array<string>) => void
  clearFocus: () => void
  hide: (ids: Array<string>) => Promise<void>
  /** Everything hidden, back at once -- the bar's Show. */
  showAll: () => Promise<void>
  /** Some of them, from the expanded tray. */
  unhide: (ids: Array<string>) => Promise<void>
  /** The hidden rows themselves, newest first, for the tray to draw. */
  hiddenImages: Array<T>
  busy: boolean
}

/**
 * The one rule about what the grid draws, extracted so it can be tested.
 *
 * **Focus wins outright.** While a spotlight is on, "hidden" is not the
 * question being asked -- you named the images you wanted, and a hidden one
 * among them is one you deliberately pointed at. Intersecting the two would
 * make a focus silently drop images you had just selected, with the strip
 * reporting a count that did not match the grid.
 */
export function isVisible(
  row: HideableRow,
  focusIds: ReadonlySet<string> | null,
): boolean {
  if (focusIds) return focusIds.has(row.id)
  return !row.hidden_at
}

/**
 * What the caller holds, in the two operations this needs.
 *
 * A patch function rather than the whole store: the optimistic write is the
 * one thing the hook cannot do for itself, and every surface with a wall of
 * rows already has a way to set a field on some of them. Naming that as two
 * lines of contract is what let the hook stop knowing about `use-gallery`.
 */
interface UseVisibilityOptions<T extends HideableRow> {
  rows: Array<T>
  /** Set `hidden_at` on these rows, in place. */
  patch: (ids: Array<string>, hiddenAt: string | null) => void
}

export function useVisibility<T extends HideableRow>({
  rows,
  patch,
}: UseVisibilityOptions<T>): VisibilityState<T> {
  const [focusIds, setFocusIds] = useState<ReadonlySet<string> | null>(null)
  const [busy, setBusy] = useState(false)

  // Newest hidden first: the tray is opened to undo something, and the thing
  // you want to undo is almost always the last thing you did.
  const hiddenImages = useMemo(
    () =>
      rows
        .filter((row) => row.hidden_at)
        .sort((a, b) => (a.hidden_at! < b.hidden_at! ? 1 : -1)),
    [rows],
  )

  const hiddenIds = useMemo(
    () => hiddenImages.map((img) => img.id),
    [hiddenImages],
  )

  const withheldIds = useMemo(() => new Set(hiddenIds), [hiddenIds])

  const visible = useCallback((row: T) => isVisible(row, focusIds), [focusIds])

  /**
   * Optimistic, then the write. A hide is a view change and has to feel like
   * one -- eight cards leaving on the next frame, not after a round trip --
   * and `patchImages` is the same vehicle a group write uses (#331).
   *
   * On failure the patch is put back rather than the grid being re-read: the
   * rows are already here, and a re-read would cost a full seed to undo one
   * field.
   */
  const write = useCallback(
    async (ids: Array<string>, hidden: boolean) => {
      if (ids.length === 0) return
      patch(ids, hidden ? new Date().toISOString() : null)
      setBusy(true)
      try {
        await setImagesHidden(ids, hidden)
      } catch (error) {
        console.error('[visibility]', error)
        patch(ids, hidden ? null : new Date().toISOString())
        toast.error(hidden ? 'Could not hide' : 'Could not show')
      } finally {
        setBusy(false)
      }
    },
    [patch],
  )

  const hide = useCallback((ids: Array<string>) => write(ids, true), [write])

  const showAll = useCallback(() => write(hiddenIds, false), [write, hiddenIds])

  const unhide = useCallback((ids: Array<string>) => write(ids, false), [write])

  const focusOn = useCallback((ids: Array<string>) => {
    setFocusIds(ids.length > 0 ? new Set(ids) : null)
  }, [])

  const clearFocus = useCallback(() => setFocusIds(null), [])

  return {
    visible,
    withheldIds,
    hiddenCount: hiddenIds.length,
    focusIds,
    focusOn,
    clearFocus,
    hide,
    showAll,
    unhide,
    hiddenImages,
    busy,
  }
}
