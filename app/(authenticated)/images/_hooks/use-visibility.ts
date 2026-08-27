'use client'

import { useCallback, useMemo, useState } from 'react'
import type { GalleryState } from './use-gallery'
import type { SavedAiImage } from '#/features/ai-images/types'
import { setImagesHidden } from '#/features/ai-images/server/gallery.action'
import { toast } from '#/components'

/**
 * What the grid is allowed to draw (#504).
 *
 * **Two states, not three.** Hidden images are hidden; Show puts them all
 * back. There is no peek -- a mode that revealed hidden rows while still
 * calling them hidden, which then had to be turned off again, was the first
 * shape and it was unusable: the strip said "4 hidden" over four visible
 * pictures, and the way out of the state was a second verb nobody had asked
 * for. If unhiding one image at a time is ever wanted, it needs a surface that
 * lists them, not a toggle over the grid.
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
export interface VisibilityState {
  /** True when this image should be drawn. */
  visible: (img: SavedAiImage) => boolean
  /** The ids being withheld, for surfaces that render images by id rather than
   *  by row -- a group card's swatches, the expanded member strip. */
  withheldIds: ReadonlySet<string>
  hiddenCount: number
  /** The spotlight, or null when there is none. */
  focusIds: ReadonlySet<string> | null
  focusOn: (ids: Array<string>) => void
  clearFocus: () => void
  hide: (ids: Array<string>) => Promise<void>
  /** Everything hidden, back at once. The only way back on purpose: it is the
   *  undo for a hide you regret, and there is nothing to understand. */
  showAll: () => Promise<void>
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
  img: SavedAiImage,
  focusIds: ReadonlySet<string> | null,
): boolean {
  if (focusIds) return focusIds.has(img.id)
  return !img.hidden_at
}

export function useVisibility(gallery: GalleryState): VisibilityState {
  const [focusIds, setFocusIds] = useState<ReadonlySet<string> | null>(null)
  const [busy, setBusy] = useState(false)

  const hiddenIds = useMemo(
    () => gallery.images.filter((img) => img.hidden_at).map((img) => img.id),
    [gallery.images],
  )

  const withheldIds = useMemo(() => new Set(hiddenIds), [hiddenIds])

  const visible = useCallback(
    (img: SavedAiImage) => isVisible(img, focusIds),
    [focusIds],
  )

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
      gallery.patchImages(ids, {
        hidden_at: hidden ? new Date().toISOString() : null,
      })
      setBusy(true)
      try {
        await setImagesHidden(ids, hidden)
      } catch (error) {
        console.error('[visibility]', error)
        gallery.patchImages(ids, {
          hidden_at: hidden ? null : new Date().toISOString(),
        })
        toast.error(hidden ? 'Could not hide' : 'Could not show')
      } finally {
        setBusy(false)
      }
    },
    [gallery],
  )

  const hide = useCallback((ids: Array<string>) => write(ids, true), [write])

  const showAll = useCallback(() => write(hiddenIds, false), [write, hiddenIds])

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
    busy,
  }
}
