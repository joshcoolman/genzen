'use client'

import { useCallback, useRef } from 'react'
import type { CanvasGroup, CanvasImage } from '../_lib/types'

interface Snapshot {
  images: Array<CanvasImage>
  groups: Array<CanvasGroup>
}

interface UseHistoryArgs {
  iRef: React.RefObject<Array<CanvasImage>>
  gRef: React.RefObject<Array<CanvasGroup>>
  setImages: (images: Array<CanvasImage>) => void
  setGroups: (groups: Array<CanvasGroup>) => void
}

const MAX_UNDO = 50

/** Undo/redo over arrangement -- positions and groupings. Keyboard only.
 *
 *  **Local by design, not by omission.** It rewinds what is on screen and never
 *  touches the server, so anything that also wrote to the database reverses its
 *  own write -- see the two toast actions in `use-removal.ts`. Leaving that to
 *  `undo()` is what made Remove-from-Canvas look undone while the membership row
 *  stayed deleted (#194). */
export function useHistory({
  iRef,
  gRef,
  setImages,
  setGroups,
}: UseHistoryArgs) {
  const undoStack = useRef<Array<Snapshot>>([])
  const redoStack = useRef<Array<Snapshot>>([])

  const pushUndo = useCallback(() => {
    undoStack.current.push({ images: iRef.current, groups: gRef.current })
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift()
    redoStack.current = []
  }, [iRef, gRef])

  /** Move one snapshot between the stacks, pushing the current state onto the
   *  other. Undo and redo differ only in direction. */
  const step = useCallback(
    (
      from: React.RefObject<Array<Snapshot>>,
      to: React.RefObject<Array<Snapshot>>,
    ) => {
      const entry = from.current.pop()
      if (!entry) return
      to.current.push({ images: iRef.current, groups: gRef.current })
      setImages(entry.images)
      setGroups(entry.groups)
      iRef.current = entry.images
      gRef.current = entry.groups
    },
    [iRef, gRef, setImages, setGroups],
  )

  const undo = useCallback(() => step(undoStack, redoStack), [step])
  const redo = useCallback(() => step(redoStack, undoStack), [step])

  return { pushUndo, undo, redo }
}
