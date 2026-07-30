'use client'

import { useCallback, useState } from 'react'
import {
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
  setImages: React.Dispatch<React.SetStateAction<Array<CanvasImage>>>
  setGroups: React.Dispatch<React.SetStateAction<Array<CanvasGroup>>>
  select: (next: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  pushUndo: () => void
  undo: () => void
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
  setImages,
  setGroups,
  select,
  pushUndo,
  undo,
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

  /** "Remove from Canvas": canvas-only removal, the row stays in the library. */
  const removeSelectionFromCanvas = useCallback(
    (ids: Array<string>) => {
      if (ids.length === 0) return
      const idSet = new Set(ids)
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
          action: { label: 'Undo', onClick: () => undo() },
        },
      )
    },
    [pushUndo, undo, stripFromCanvas, recordIdsFor, canvasId],
  )

  /** "Move to Trash": soft-delete, which is a library operation. Membership is
   *  deliberately kept -- the card comes off screen because the canvas read
   *  filters `deleted_at`. */
  const moveSelectionToTrash = useCallback(
    (ids: Array<string>) => {
      if (ids.length === 0) return
      const idSet = new Set(ids)
      const removed = iRef.current.filter((img) => idSet.has(img.id))
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
                  void restoreFromTrash(recordIds)
                },
              },
            },
          ),
        )
        .catch(() => toast.error('Failed to move to Trash'))
    },
    [pushUndo, stripFromCanvas, recordIdsFor, setImages, iRef],
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
