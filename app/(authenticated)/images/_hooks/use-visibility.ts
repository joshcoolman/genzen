'use client'

import { useCallback, useMemo, useState } from 'react'
import type { GalleryState } from './use-gallery'
import type { SavedAiImage } from '#/features/ai-images/types'
import { setImagesHidden } from '#/features/ai-images/server/gallery.action'
import { toast } from '#/components'

/**
 * What the grid is allowed to draw (#504).
 *
 * **Hide and focus are one mechanism from opposite ends.** "Hide these eight"
 * and "show only these two" both produce a filtered view, and building them as
 * two features would have been two filters to keep in agreement. So there is
 * one predicate, `visible`, with two inputs.
 *
 * They differ in what they are *for*, which is why only one of them persists:
 *
 * - **Hidden is a decision.** It survives a refresh, because the noise you
 *   cleared away is still noise tomorrow. It is a column (`hidden_at`).
 * - **Focus is a glance.** Show me these two while I think about them. It
 *   lives in this hook and dies with the page, because a spotlight you left on
 *   yesterday is indistinguishable from a broken gallery.
 *
 * The count is the safety design, not the hiding. Hidden state that is not
 * visible is a slower kind of lost, and it would be trusted about twice before
 * it burned someone -- so the strip that says how many are hidden is the part
 * that has to be impossible to miss, and it is why hiding can be a single
 * click with no confirmation.
 */
export interface VisibilityState {
  /** True when this image should be drawn, given the current focus and
   *  whether hidden rows are being shown. */
  visible: (img: SavedAiImage) => boolean
  /** How many images are hidden right now, across the whole library -- not
   *  scoped to the group you are in. Scoping it would report zero while you
   *  stood in a group whose images were all visible, which is the moment the
   *  count exists to speak up. */
  hiddenCount: number
  /** The ids currently being withheld from the grid, for surfaces that render
   *  images by id rather than by row -- a group card's swatches. Empty while
   *  hidden rows are being shown, so those surfaces track the toggle without
   *  knowing it exists. */
  withheldIds: ReadonlySet<string>
  /** Hidden rows are being drawn, marked, and can be unhidden. */
  showHidden: boolean
  setShowHidden: (show: boolean) => void
  /** The spotlight, or null when there is none. */
  focusIds: ReadonlySet<string> | null
  focusOn: (ids: Array<string>) => void
  clearFocus: () => void
  hide: (ids: Array<string>) => Promise<void>
  unhide: (ids: Array<string>) => Promise<void>
  busy: boolean
}

/**
 * The one rule about what the grid draws, extracted so it can be tested.
 *
 * **Focus wins outright.** While a spotlight is on, "hidden" is not the
 * question being asked -- you named the images you wanted, and a hidden one
 * among them is one you deliberately pointed at. The alternative, intersecting
 * the two, makes a focus silently drop images you had selected, with the strip
 * reporting a count that does not match the grid.
 */
export function isVisible(
  img: SavedAiImage,
  focusIds: ReadonlySet<string> | null,
  showHidden: boolean,
): boolean {
  if (focusIds) return focusIds.has(img.id)
  return showHidden || !img.hidden_at
}

export function useVisibility(gallery: GalleryState): VisibilityState {
  const [showHidden, setShowHidden] = useState(false)
  const [focusIds, setFocusIds] = useState<ReadonlySet<string> | null>(null)
  const [busy, setBusy] = useState(false)

  const hiddenCount = useMemo(
    () => gallery.images.filter((img) => img.hidden_at).length,
    [gallery.images],
  )

  const withheldIds = useMemo(() => {
    if (showHidden) return new Set<string>()
    return new Set(
      gallery.images.filter((img) => img.hidden_at).map((img) => img.id),
    )
  }, [gallery.images, showHidden])

  const visible = useCallback(
    (img: SavedAiImage) => isVisible(img, focusIds, showHidden),
    [focusIds, showHidden],
  )

  /**
   * Optimistic, then the write. A hide is a view change and has to feel like
   * one -- eight cards leaving on the next frame, not after a round trip --
   * and `patchImages` is the same vehicle a group write uses (#331).
   *
   * On failure the patch is put back rather than the grid being re-read: the
   * rows are already here and a re-read would cost a full seed to undo one
   * field.
   */
  const write = useCallback(
    async (ids: Array<string>, hidden: boolean) => {
      if (ids.length === 0) return
      const at = hidden ? new Date().toISOString() : null
      gallery.patchImages(ids, { hidden_at: at })
      setBusy(true)
      try {
        await setImagesHidden(ids, hidden)
      } catch (error) {
        console.error('[visibility]', error)
        gallery.patchImages(ids, { hidden_at: hidden ? null : at })
        toast.error(hidden ? 'Could not hide' : 'Could not unhide')
      } finally {
        setBusy(false)
      }
    },
    [gallery],
  )

  const hide = useCallback((ids: Array<string>) => write(ids, true), [write])
  const unhide = useCallback((ids: Array<string>) => write(ids, false), [write])

  const focusOn = useCallback((ids: Array<string>) => {
    setFocusIds(ids.length > 0 ? new Set(ids) : null)
  }, [])

  const clearFocus = useCallback(() => setFocusIds(null), [])

  return {
    visible,
    withheldIds,
    hiddenCount,
    showHidden,
    setShowHidden,
    focusIds,
    focusOn,
    clearFocus,
    hide,
    unhide,
    busy,
  }
}
