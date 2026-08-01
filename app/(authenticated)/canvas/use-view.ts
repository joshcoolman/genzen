'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { stateToImages } from './_lib/persistence'
import { useHistory } from './_hooks/use-history'
import { useViewport } from './_hooks/use-viewport'
import { useSelection } from './_hooks/use-selection'
import { useRemoval } from './_hooks/use-removal'
import { useIngest } from './_hooks/use-ingest'
import { useAutosave } from './_hooks/use-autosave'
import { useReconcile } from './_hooks/use-reconcile'
import { useCanvasHotkeys } from './_hooks/use-canvas-hotkeys'
import { useCanvasGenerate } from './_components/canvas-generate-dialog/use-canvas-generate'
import type { CanvasGroup, CanvasImage, DragMode } from './_lib/types'
// Explicitly imported: `CanvasState` is also a lib.dom global, so without this
// the props type silently resolves to the DOM one.
import type { CanvasState } from './_lib/persistence'
import { useAuth } from '#/lib/auth'
import { useExistingImages } from '#/features/user-images'

/** Everything the canvas view renders.
 *
 *  This composes the concern hooks rather than holding their state: the
 *  viewport owns pan/zoom, selection owns what is picked and the group ops,
 *  history owns undo/redo, ingest owns everything that adds a card, removal
 *  owns the two ways one leaves. What is left here is the shared image/group
 *  state they all read, the pointer handlers that arbitrate between them, and
 *  the wiring. */
export function useView(initial: CanvasState) {
  // Seeded, not fetched. The server read already resolved every member's URL and
  // position, so the first render is the real canvas.
  const seed = useMemo(() => stateToImages(initial), [initial])
  const canvasId = initial.canvasId

  const [images, setImages] = useState<Array<CanvasImage>>(seed.images)
  const [groups, setGroups] = useState<Array<CanvasGroup>>(initial.groups)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    imageId: string
  } | null>(null)
  const dialogOpenRef = useRef(false)

  const { user } = useAuth()
  const {
    images: libraryImages,
    imageUrls: libraryImageUrls,
    isLoading: libraryLoading,
  } = useExistingImages(user.id)

  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const iRef = useRef(images)
  const gRef = useRef(groups)
  // Right-button drag pans the canvas. Track it so a right-drag suppresses the
  // context menu while a plain right-click still opens it.
  const rightPanRef = useRef(false)
  const suppressContextRef = useRef(false)
  const pasteTargetRef = useRef<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{
    mode: DragMode
    sx: number
    sy: number
    moved: boolean
  }>({
    mode: null,
    sx: 0,
    sy: 0,
    moved: false,
  })

  const { pushUndo, undo, redo } = useHistory({
    iRef,
    gRef,
    setImages,
    setGroups,
  })

  const viewport = useViewport({
    initial: initial.transform,
    containerRef,
    dialogOpenRef,
  })
  const {
    transform,
    tRef,
    spaceHeld,
    spaceRef,
    screenToCanvas,
    zoomCenter,
    fitBounds,
  } = viewport

  const {
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
  } = useSelection({ iRef, gRef, setImages, setGroups, pushUndo })

  const getImages = useCallback(() => iRef.current, [])

  const canvasGen = useCanvasGenerate(
    setImages,
    pushUndo,
    getImages,
    viewport.fitBounds,
    groupImages,
  )

  const { moveSelectionToTrash, dismissFailed } = useRemoval({
    canvasId,
    iRef,
    setImages,
    setGroups,
    select,
    pushUndo,
  })

  const getPasteTarget = useCallback(
    () => pasteTargetRef.current ?? viewport.viewportCenter(),
    [viewport],
  )

  const { dropNotice, onDragOver, onDrop, onFileChange, onLibraryConfirm } =
    useIngest({
      canvasId,
      setImages,
      select,
      pushUndo,
      getPasteTarget,
      screenToCanvas,
      createImage: canvasGen.userImages.create,
      libraryImages,
    })

  useAutosave({ canvasId, images, groups, transform, iRef, gRef, tRef })

  useReconcile({
    initial,
    seed,
    setImages,
    resumePending: canvasGen.resumePending,
  })

  useEffect(() => {
    iRef.current = images
  }, [images])
  useEffect(() => {
    gRef.current = groups
  }, [groups])
  useEffect(() => {
    dialogOpenRef.current = canvasGen.isOpen || libraryOpen
  }, [canvasGen.isOpen, libraryOpen])

  /* -- Pointer events -- */

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Right button: pan the canvas (drag) -- a plain right-click (no drag)
    // falls through to the context menu via onContextMenu.
    if (e.button === 2) {
      rightPanRef.current = true
      suppressContextRef.current = false
      dragRef.current = {
        mode: 'pan',
        sx: e.clientX,
        sy: e.clientY,
        moved: false,
      }
      containerRef.current?.setPointerCapture(e.pointerId)
      return
    }
    if (e.button !== 0) return

    // Check for group background click
    const groupTarget = (e.target as HTMLElement).closest('[data-group-id]')
    const groupId = groupTarget?.getAttribute('data-group-id')
    if (groupId && !spaceRef.current) {
      const group = gRef.current.find((g) => g.id === groupId)
      if (group) {
        const next = new Set(group.imageIds)
        select(next)
        dragRef.current = {
          mode: 'move',
          sx: e.clientX,
          sy: e.clientY,
          moved: false,
        }
        containerRef.current?.setPointerCapture(e.pointerId)
        return
      }
    }

    const target = (e.target as HTMLElement).closest('[data-image-id]')
    const imageId = target?.getAttribute('data-image-id')

    if (imageId && !spaceRef.current) {
      // Check if this image belongs to a group
      const group = gRef.current.find((g) => g.imageIds.includes(imageId))

      if (e.shiftKey) {
        if (group) {
          // Shift+click on grouped image: toggle entire group
          select((prev) => {
            const next = new Set(prev)
            const allIn = group.imageIds.every((id) => next.has(id))
            if (allIn) {
              group.imageIds.forEach((id) => next.delete(id))
            } else {
              group.imageIds.forEach((id) => next.add(id))
            }
            return next
          })
        } else {
          select((prev) => {
            const next = new Set(prev)
            next.has(imageId) ? next.delete(imageId) : next.add(imageId)
            return next
          })
        }
      } else if (group) {
        // Click on grouped image: select entire group
        if (!group.imageIds.every((id) => sRef.current.has(id))) {
          const next = new Set(group.imageIds)
          select(next)
        }
      } else if (!sRef.current.has(imageId)) {
        const next = new Set([imageId])
        select(next)
      }
      dragRef.current = {
        mode: 'move',
        sx: e.clientX,
        sy: e.clientY,
        moved: false,
      }
    } else if (spaceRef.current) {
      dragRef.current = {
        mode: 'pan',
        sx: e.clientX,
        sy: e.clientY,
        moved: false,
      }
    } else {
      dragRef.current = {
        mode: 'marquee',
        sx: e.clientX,
        sy: e.clientY,
        moved: false,
      }
    }

    containerRef.current?.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current
      if (!d.mode) return
      if (
        !d.moved &&
        Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3
      ) {
        d.moved = true
        if (d.mode === 'move') pushUndo()
      }
      if (!d.moved) return

      if (d.mode === 'pan') {
        viewport.panBy(e.clientX - d.sx, e.clientY - d.sy)
        d.sx = e.clientX
        d.sy = e.clientY
      } else if (d.mode === 'move') {
        const t = tRef.current
        const dx = (e.clientX - d.sx) / t.scale
        const dy = (e.clientY - d.sy) / t.scale
        setImages((prev) =>
          prev.map((img) =>
            sRef.current.has(img.id)
              ? { ...img, x: img.x + dx, y: img.y + dy }
              : img,
          ),
        )
        d.sx = e.clientX
        d.sy = e.clientY
      } else {
        setMarquee({ x1: d.sx, y1: d.sy, x2: e.clientX, y2: e.clientY })
      }
    },
    [pushUndo],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current
      // A right-drag that actually moved = a pan; swallow the context menu that
      // fires right after. A right-click that didn't move still opens the menu.
      if (rightPanRef.current) {
        suppressContextRef.current = d.moved
        rightPanRef.current = false
      }
      if (d.mode === 'marquee' && d.moved) {
        const c1 = screenToCanvas(d.sx, d.sy)
        const c2 = screenToCanvas(e.clientX, e.clientY)
        const left = Math.min(c1.x, c2.x),
          top = Math.min(c1.y, c2.y)
        const right = Math.max(c1.x, c2.x),
          bottom = Math.max(c1.y, c2.y)
        const hit = new Set<string>()
        for (const img of iRef.current) {
          if (
            img.x + img.width >= left &&
            img.x <= right &&
            img.y + img.height >= top &&
            img.y <= bottom
          ) {
            hit.add(img.id)
          }
        }
        // Expand selection to include full groups if any member was hit
        for (const g of gRef.current) {
          if (g.imageIds.some((id) => hit.has(id))) {
            g.imageIds.forEach((id) => hit.add(id))
          }
        }
        if (e.shiftKey) {
          select((prev) => {
            const m = new Set(prev)
            hit.forEach((id) => m.add(id))
            return m
          })
        } else {
          select(hit)
        }
        setMarquee(null)
      } else if (d.mode === 'marquee' && !d.moved) {
        pasteTargetRef.current = screenToCanvas(e.clientX, e.clientY)
        clearSelection()
        setMarquee(null)
      }
      dragRef.current = { mode: null, sx: 0, sy: 0, moved: false }
    },
    [screenToCanvas],
  )

  useCanvasHotkeys({
    iRef,
    sRef,
    tRef,
    dialogOpenRef,
    zoomCenter,
    fitBounds,
    focusBounds: viewport.focusBounds,
    select,
    clearSelection,
    groupSelected,
    ungroupSelected,
    undo,
    redo,
    onDelete: moveSelectionToTrash,
  })

  /** Right-click opens the menu on a card. A right-drag that panned has
   *  already set the suppress flag, so it does not also pop the menu. */
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (suppressContextRef.current) {
      suppressContextRef.current = false
      return
    }
    const target = (e.target as HTMLElement).closest('[data-image-id]')
    const imageId = target?.getAttribute('data-image-id')
    if (imageId) setContextMenu({ x: e.clientX, y: e.clientY, imageId })
  }, [])

  return {
    // state
    images,
    groups,
    selected,
    transform,
    marquee,
    spaceHeld,
    contextMenu,
    setContextMenu,
    dropNotice,
    // refs
    containerRef,
    fileInputRef,
    // generation
    canvasGen,
    // library picker
    libraryOpen,
    setLibraryOpen,
    libraryImages,
    libraryImageUrls,
    libraryLoading,
    onLibraryConfirm,
    // pointer + input handlers
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onContextMenu,
    onDragOver,
    onDrop,
    onFileChange,
    // operations
    getSelectedGroup,
    arrangeSelected,
    groupSelected,
    ungroupSelected,
    moveSelectionToTrash,
    dismissFailed,
  }
}
