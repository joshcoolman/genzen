'use client'

import { useCallback } from 'react'
import { moveToTrash, removeFromCanvas } from '../_lib/persistence'
import type { CanvasGroup, CanvasImage } from '../_lib/types'
import { toast } from '#/components'

interface UseRemovalArgs {
  canvasId: string
  iRef: React.RefObject<Array<CanvasImage>>
  setImages: React.Dispatch<React.SetStateAction<Array<CanvasImage>>>
  setGroups: React.Dispatch<React.SetStateAction<Array<CanvasGroup>>>
  select: (next: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  pushUndo: () => void
}

/** How a card leaves the canvas: it goes to Trash.
 *
 *  There used to be two ways and a modal that made the user choose between them.
 *  Remove-from-Canvas deleted the membership row and kept the library row, which
 *  made it the one operation in the app that quietly destroyed work -- the
 *  arrangement -- with no way back, since Trash only holds trashed images and a
 *  re-added membership row comes back unplaced. Rather than keep an undo for the
 *  single exception, #236 dropped the operation. Now everything reversible just
 *  happens and only Trash's permanent deletes ask.
 *
 *  Trashing soft-deletes the library row and leaves membership alone (#212), so
 *  a restore from Trash puts the card back at the same coordinates. That
 *  recovery is the confirmation; there is no dialog and no Undo toast in front
 *  of it. */
export function useRemoval({
  canvasId,
  iRef,
  setImages,
  setGroups,
  select,
  pushUndo,
}: UseRemovalArgs) {
  /** Strip images off the canvas locally (images, groups, selection). Does not
   *  touch the DB or undo stack -- callers handle membership / deleted_at. */
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

  /** "Move to Trash": soft-delete, which is a library operation. Membership is
   *  deliberately kept -- the card comes off screen because the canvas read
   *  filters `deleted_at`.
   *
   *  Says nothing on success (#236). It used to raise a six-second toast with an
   *  Undo that reversed its own server write; Trash recovers this whether or not
   *  anyone caught the toast, so the toast was a shortcut over a recovery that
   *  already exists. A failure still speaks -- silence there would be a lie,
   *  because the cards have already left the screen.
   *
   *  `pushUndo` stays. The local stack rewinds arrangement and never touched
   *  `deleted_at`, so removing the toast changes nothing about what Cmd-Z does
   *  here -- and the toast deliberately never went through it (#194). */
  const moveSelectionToTrash = useCallback(
    (ids: Array<string>) => {
      if (ids.length === 0) return
      const idSet = new Set(ids)
      const recordIds = recordIdsFor(idSet)
      pushUndo()
      stripFromCanvas(idSet)
      void moveToTrash(recordIds).catch(() =>
        toast.error('Failed to move to Trash'),
      )
    },
    [pushUndo, stripFromCanvas, recordIdsFor],
  )

  /** Drop a single failed tile: no trash -- it never became an image. */
  const dismissFailed = useCallback(
    (id: string, recordId: string | undefined) => {
      if (recordId) void removeFromCanvas(canvasId, [recordId])
      setImages((prev) => prev.filter((ci) => ci.id !== id))
    },
    [canvasId, setImages],
  )

  return {
    moveSelectionToTrash,
    dismissFailed,
  }
}
