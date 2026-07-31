'use client'

import { useCallback, useState } from 'react'
import {
  addToCanvas,
  membersForRestore,
  moveToTrash,
  removeFromCanvas,
  restoreFromTrash,
} from '../_lib/persistence'
import type { CanvasGroup, CanvasImage } from '../_lib/types'
import { toast } from '#/components'

const UNDO_TOAST_MS = 6000

interface UseRemovalArgs {
  canvasId: string
  iRef: React.RefObject<Array<CanvasImage>>
  gRef: React.RefObject<Array<CanvasGroup>>
  setImages: React.Dispatch<React.SetStateAction<Array<CanvasImage>>>
  setGroups: React.Dispatch<React.SetStateAction<Array<CanvasGroup>>>
  select: (next: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  pushUndo: () => void
}

/** The two ways a card leaves the canvas, and the modal that makes the user
 *  choose between them.
 *
 *  They are different operations on purpose (#212). Remove deletes the
 *  membership row and leaves the library untouched. Trash soft-deletes the
 *  library row and leaves membership alone, so a restore puts the card back at
 *  the same coordinates instead of making the user re-arrange it. */
export function useRemoval({
  canvasId,
  iRef,
  gRef,
  setImages,
  setGroups,
  select,
  pushUndo,
}: UseRemovalArgs) {
  /** Pending delete awaiting the confirm modal's choice. */
  const [deleteConfirm, setDeleteConfirm] = useState<{
    ids: Array<string>
  } | null>(null)

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

  /** "Remove from Canvas": canvas-only removal, the row stays in the library.
   *
   *  The Undo restores **both halves** -- the cards on screen and the membership
   *  rows that back them. It used to call `undo()` alone, which only rewinds the
   *  local arrangement, so the cards reappeared over a canvas the database no
   *  longer had them on and the next load dropped them for good (#194). That is
   *  the worst shape a bug can take: it looked like it worked.
   *
   *  Restoring from a captured snapshot rather than through `undo()` is
   *  deliberate, and is the pattern Move to Trash already used. The toast lives
   *  for six seconds, and anything the user does in those six seconds pushes its
   *  own entry -- so popping the stack could rewind a drag instead of this
   *  removal. A snapshot undoes the thing the toast is about. */
  const removeSelectionFromCanvas = useCallback(
    (ids: Array<string>) => {
      if (ids.length === 0) return
      const idSet = new Set(ids)
      const removed = iRef.current.filter((img) => idSet.has(img.id))
      const groupsBefore = gRef.current
      const recordIds = recordIdsFor(idSet)

      pushUndo()
      void removeFromCanvas(canvasId, recordIds)
      stripFromCanvas(idSet)

      toast(
        ids.length === 1
          ? 'Removed from canvas'
          : `Removed ${ids.length} from canvas`,
        {
          duration: UNDO_TOAST_MS,
          action: {
            label: 'Undo',
            onClick: () => {
              setImages((prev) => [
                ...prev,
                ...removed.filter((r) => !prev.some((p) => p.id === r.id)),
              ])
              // A removal empties the groups its members were in; put them back,
              // or the cards return ungrouped and the slab is gone.
              setGroups(groupsBefore)
              // The durable half. Position rides along because `saveCanvasState`
              // writes arrangement and never membership -- a row that does not
              // exist cannot be given coordinates.
              void addToCanvas(canvasId, membersForRestore(removed))
            },
          },
        },
      )
    },
    [
      pushUndo,
      stripFromCanvas,
      recordIdsFor,
      canvasId,
      iRef,
      gRef,
      setImages,
      setGroups,
    ],
  )

  /** "Move to Trash": soft-delete, which is a library operation. Membership is
   *  deliberately kept -- the card comes off screen because the canvas read
   *  filters `deleted_at`. */
  const moveSelectionToTrash = useCallback(
    (ids: Array<string>) => {
      if (ids.length === 0) return
      const idSet = new Set(ids)
      const removed = iRef.current.filter((img) => idSet.has(img.id))
      const groupsBefore = gRef.current
      const recordIds = recordIdsFor(idSet)
      pushUndo()
      stripFromCanvas(idSet)
      void moveToTrash(recordIds)
        .then(() =>
          toast.success(
            ids.length === 1
              ? 'Moved to Trash'
              : `Moved ${ids.length} to Trash`,
            {
              duration: UNDO_TOAST_MS,
              action: {
                label: 'Undo',
                onClick: () => {
                  setImages((prev) => [
                    ...prev,
                    ...removed.filter((r) => !prev.some((p) => p.id === r.id)),
                  ])
                  setGroups(groupsBefore)
                  // Membership survived the trash (#212), so only `deleted_at`
                  // has to be undone here -- no `addToCanvas`.
                  void restoreFromTrash(recordIds)
                },
              },
            },
          ),
        )
        .catch(() => toast.error('Failed to move to Trash'))
    },
    [pushUndo, stripFromCanvas, recordIdsFor, setImages, setGroups, iRef, gRef],
  )

  /** Drop a single failed tile: no undo, no trash -- it never became an image. */
  const dismissFailed = useCallback(
    (id: string, recordId: string | undefined) => {
      if (recordId) void removeFromCanvas(canvasId, [recordId])
      setImages((prev) => prev.filter((ci) => ci.id !== id))
    },
    [canvasId, setImages],
  )

  return {
    deleteConfirm,
    setDeleteConfirm,
    removeSelectionFromCanvas,
    moveSelectionToTrash,
    dismissFailed,
  }
}
