'use client'

import { useCallback, useRef, useState } from 'react'
import { layoutMasonry } from '../_lib/masonry'
import { getBounds, spatialSort } from '../_lib/geometry'
import type { CanvasGroup, CanvasImage } from '../_lib/types'

export interface Marquee {
  x1: number
  y1: number
  x2: number
  y2: number
}

interface UseSelectionArgs {
  iRef: React.RefObject<Array<CanvasImage>>
  gRef: React.RefObject<Array<CanvasGroup>>
  setImages: React.Dispatch<React.SetStateAction<Array<CanvasImage>>>
  setGroups: React.Dispatch<React.SetStateAction<Array<CanvasGroup>>>
  pushUndo: () => void
}

/** What is selected, the marquee that selects it, and the grouping operations
 *  over a selection.
 *
 *  `sRef` mirrors `selected` for the same reason the viewport mirrors its
 *  transform: pointer handlers read the live selection mid-drag. Always change
 *  the selection through `select()` so the two cannot drift. */
export function useSelection({
  iRef,
  gRef,
  setImages,
  setGroups,
  pushUndo,
}: UseSelectionArgs) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [marquee, setMarquee] = useState<Marquee | null>(null)
  const sRef = useRef(selected)

  /** Set the selection and its ref together. Takes a value or an updater. */
  const select = useCallback(
    (next: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      setSelected((prev) => {
        const value = typeof next === 'function' ? next(prev) : next
        sRef.current = value
        return value
      })
      if (typeof next !== 'function') sRef.current = next
    },
    [],
  )

  const clearSelection = useCallback(() => select(new Set()), [select])

  /** The group that the selection is exactly, or null. Drives whether the
   *  toolbar offers Group or Ungroup. */
  const getSelectedGroup = useCallback(() => {
    const sel = sRef.current
    if (sel.size < 2) return null
    const selArr = [...sel]
    return (
      gRef.current.find(
        (g) =>
          g.imageIds.length === selArr.length &&
          selArr.every((id) => g.imageIds.includes(id)),
      ) ?? null
    )
  }, [gRef])

  /** Masonry-arrange a set of images in place, centred on their own bounds.
   *  Shared by arrange and group, which differ only in whether a group row is
   *  written afterwards. */
  const arrangeIds = useCallback(
    (imgs: Array<CanvasImage>, columns: number) => {
      const sorted = spatialSort(imgs)
      const bounds = getBounds(imgs)
      const items = sorted.map((img) => ({
        id: img.id,
        width: img.width,
        height: img.height,
      }))
      const posMap = new Map(
        layoutMasonry(items, columns, bounds.x + bounds.w / 2, bounds.y).map(
          (r) => [r.id, r],
        ),
      )
      setImages((prev) =>
        prev.map((img) => {
          const pos = posMap.get(img.id)
          return pos
            ? {
                ...img,
                x: pos.x,
                y: pos.y,
                width: pos.width,
                height: pos.height,
              }
            : img
        }),
      )
    },
    [setImages],
  )

  const arrangeSelected = useCallback(
    (columns: number) => {
      const sel = sRef.current
      if (sel.size < 2) return
      pushUndo()
      arrangeIds(
        iRef.current.filter((img) => sel.has(img.id)),
        columns,
      )
    },
    [pushUndo, arrangeIds, iRef],
  )

  const groupSelected = useCallback(
    (columns: number) => {
      const sel = sRef.current
      if (sel.size < 2) return
      pushUndo()
      const selArr = [...sel]
      arrangeIds(
        iRef.current.filter((img) => sel.has(img.id)),
        columns,
      )
      setGroups((prev) => [
        ...prev
          .map((g) => ({
            ...g,
            imageIds: g.imageIds.filter((id) => !sel.has(id)),
          }))
          .filter((g) => g.imageIds.length >= 2),
        { id: crypto.randomUUID(), imageIds: selArr, columns, padding: 24 },
      ])
    },
    [pushUndo, arrangeIds, iRef, setGroups],
  )

  const ungroupSelected = useCallback(() => {
    const sel = sRef.current
    pushUndo()
    setGroups((prev) =>
      prev.filter((g) => !g.imageIds.some((id) => sel.has(id))),
    )
  }, [pushUndo, setGroups])

  /** Wrap already-positioned images in a group without re-arranging them
   *  (unlike groupSelected). Used to auto-group a generation's origin with its
   *  previews, which are already laid out where they belong. */
  const groupImages = useCallback(
    (imageIds: Array<string>, columns: number) => {
      if (imageIds.length < 2) return
      const idSet = new Set(imageIds)
      setGroups((prev) => [
        ...prev
          .map((g) => ({
            ...g,
            imageIds: g.imageIds.filter((id) => !idSet.has(id)),
          }))
          .filter((g) => g.imageIds.length >= 2),
        { id: crypto.randomUUID(), imageIds, columns, padding: 24 },
      ])
    },
    [setGroups],
  )

  return {
    selected,
    sRef,
    select,
    clearSelection,
    marquee,
    setMarquee,
    getSelectedGroup,
    arrangeSelected,
    groupSelected,
    ungroupSelected,
    groupImages,
  }
}
