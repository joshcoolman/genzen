'use client'

import { useCallback } from 'react'
import { removeFromCanvas } from '../_lib/persistence'
import type { CanvasGroup, CanvasImage } from '../_lib/types'
import { toast } from '#/components'

/** How a card leaves the canvas: it stops being on the canvas. Nothing else.
 *
 *  This verb existed, was replaced by a Move-to-Trash in #236, and is back
 *  (#373). #236's reasoning was that removing "quietly destroyed work -- the
 *  arrangement -- with no way back", so it made removal a library soft-delete
 *  and preserved membership so a restore returned the card to its coordinates.
 *  That reasoning belonged to a canvas whose arrangement was the only structure
 *  in the app. Groups hold the durable structure now, so the board is scratch:
 *  a position is not work, and losing one costs nothing worth a recovery path.
 *
 *  What it bought instead was a canvas that reached into the library. Deleting
 *  five cards trashed five images, cleared their `group_id` (#319), and left a
 *  `canvas_images` row that made them undeletable from Trash forever (#371).
 *
 *  The rule that makes this safe: **a canvas holds references, never
 *  originals.** Every entry path -- paste, drop, upload, library picker,
 *  generation -- writes a `user_images` row first. Removing a card cannot lose
 *  an image, only a position. */
export function useRemoval({
  canvasId,
  iRef,
  setImages,
  setGroups,
  select,
}: {
  canvasId: string
  iRef: React.RefObject<Array<CanvasImage>>
  setImages: React.Dispatch<React.SetStateAction<Array<CanvasImage>>>
  setGroups: React.Dispatch<React.SetStateAction<Array<CanvasGroup>>>
  select: (next: Set<string> | ((prev: Set<string>) => Set<string>)) => void
}) {
  /** Strip images off the canvas locally (images, groups, selection). */
  const stripFromCanvas = useCallback(
    (idSet: Set<string>) => {
      setImages((prev) => prev.filter((img) => !idSet.has(img.id)))
      setGroups((prev) =>
        prev
          .map((g) => ({
            ...g,
            imageIds: g.imageIds.filter((id) => !idSet.has(id)),
          }))
          .filter((g) => g.imageIds.length >= 2),
      )
      select((prev) => {
        const next = new Set(prev)
        for (const id of idSet) next.delete(id)
        return next
      })
    },
    [setImages, setGroups, select],
  )

  const recordIdsFor = useCallback(
    (idSet: Set<string>) =>
      iRef.current
        .filter((img) => idSet.has(img.id) && img.recordId)
        .map((img) => img.recordId),
    [iRef],
  )

  /** Take the selection off the canvas. The library rows are untouched, so the
   *  images are still in Images exactly as they were -- including whatever
   *  group they belong to.
   *
   *  Says nothing on success. A failure still speaks: the cards have already
   *  left the screen, so silence there would be a lie. */
  const removeSelectionFromCanvas = useCallback(
    (ids: Array<string>) => {
      if (ids.length === 0) return
      const idSet = new Set(ids)
      const recordIds = recordIdsFor(idSet)
      stripFromCanvas(idSet)
      void removeFromCanvas(canvasId, recordIds).catch(() =>
        toast.error('Failed to remove from canvas'),
      )
    },
    [canvasId, stripFromCanvas, recordIdsFor],
  )

  /** Drop a single failed tile: it never became an image. */
  const dismissFailed = useCallback(
    (id: string, recordId: string | undefined) => {
      if (recordId) void removeFromCanvas(canvasId, [recordId])
      setImages((prev) => prev.filter((ci) => ci.id !== id))
    },
    [canvasId, setImages],
  )

  return {
    removeSelectionFromCanvas,
    dismissFailed,
  }
}
