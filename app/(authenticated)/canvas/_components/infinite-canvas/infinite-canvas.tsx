'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { stateToImages } from '../../_lib/persistence'
import { getBounds } from '../../_lib/geometry'
import { useHistory } from '../../_hooks/use-history'
import { useViewport } from '../../_hooks/use-viewport'
import { useSelection } from '../../_hooks/use-selection'
import { useRemoval } from '../../_hooks/use-removal'
import { useIngest } from '../../_hooks/use-ingest'
import { useAutosave } from '../../_hooks/use-autosave'
import { useReconcile } from '../../_hooks/use-reconcile'
import { useCanvasHotkeys } from '../../_hooks/use-canvas-hotkeys'
import { useCanvasGenerate } from '../canvas-generate-dialog/use-canvas-generate'
import { CANVAS_MAX_GROUP_SELECTION } from '../../_lib/canvas-models'
import { SelectionActions } from '../selection-actions/selection-actions'
import { CanvasSurface } from '../canvas-surface/canvas-surface'
import { ImageCard } from '../image-card/image-card'
import { GroupBackground } from '../group-background/group-background'
import { ModelLabel } from '../model-label/model-label'
import { PendingOverlay } from '../pending-overlay/pending-overlay'
import { SelectionBounds } from '../selection-bounds/selection-bounds'
import { GeneratePill } from '../generate-pill/generate-pill'
import { MarqueeBox } from '../marquee-box/marquee-box'
import { EmptyPrompt } from '../empty-prompt/empty-prompt'
import { ContextMenu } from '../context-menu/context-menu'
import { DeleteConfirm } from '../delete-confirm/delete-confirm'
import { DropNotice } from '../drop-notice/drop-notice'
import { CanvasGenerateDialog } from '../canvas-generate-dialog/canvas-generate-dialog'
import { ExistingImagePicker } from '../../../_components/existing-image-picker/existing-image-picker'
import type { CanvasGroup, CanvasImage, DragMode } from '../../_lib/types'
// Explicitly imported: `CanvasState` is also a lib.dom global, so without this
// the props type silently resolves to the DOM one.
import type { CanvasState } from '../../_lib/persistence'
import { getModelName } from '#/features/ai-images/models'
import { useAuth } from '#/lib/auth'
import { useExistingImages } from '#/features/user-images'

/** Below this zoom the screen-space labels are noise, so they are dropped. */
const MODEL_LABEL_MIN_SCALE = 0.1
/** Label sits this far above its card, in screen pixels. */
const MODEL_LABEL_OFFSET = 22
/** The selection box is drawn slightly outside the content it wraps. */
const SELECTION_INSET = 6
/** Gap between the selection box and the Generate pill below it. */
const PILL_GAP = 10

interface InfiniteCanvasProps {
  /** The canvas as the server read it. Seeds the first render, so there is no
   *  loading gate and no empty first paint (#212). */
  initial: CanvasState
}

export function InfiniteCanvas({ initial }: InfiniteCanvasProps) {
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

  const {
    deleteConfirm,
    setDeleteConfirm,
    removeSelectionFromCanvas,
    moveSelectionToTrash,
    dismissFailed,
  } = useRemoval({
    canvasId,
    iRef,
    setImages,
    setGroups,
    select,
    pushUndo,
    undo,
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
    onDeleteRequest: (ids) => setDeleteConfirm({ ids }),
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

  /* -- Render -- */

  // Nothing is ever "already collected" on the canvas -- a library image can be
  // placed more than once.
  const emptySet = useMemo(() => new Set<string>(), [])

  const selectionBounds =
    selected.size >= 1
      ? getBounds(images.filter((img) => selected.has(img.id)))
      : null

  /** Canvas point -> screen point, for the overlays outside the plane. */
  const toScreen = (x: number, y: number) => ({
    left: transform.x + x * transform.scale,
    top: transform.y + y * transform.scale,
  })

  /** Inside a live multi-selection's box but not in it -- about to be left
   *  behind by the drag, so the card dims. */
  const isDimmed = (img: CanvasImage) =>
    selected.size >= 2 &&
    !!selectionBounds &&
    !selected.has(img.id) &&
    img.x + img.width >= selectionBounds.x &&
    img.x <= selectionBounds.x + selectionBounds.w &&
    img.y + img.height >= selectionBounds.y &&
    img.y <= selectionBounds.y + selectionBounds.h

  // The pill needs a settled, fully-loaded selection: no pending tiles, and
  // small enough that some model can hold every image as a reference.
  const pillImages = images.filter((img) => selected.has(img.id))
  const showPill =
    selected.size >= 1 &&
    selected.size <= CANVAS_MAX_GROUP_SELECTION &&
    !canvasGen.isOpen &&
    pillImages.length === selected.size &&
    !pillImages.some((img) => img.pending)

  const containerRect = containerRef.current?.getBoundingClientRect()

  return (
    <>
      <CanvasSurface
        containerRef={containerRef}
        transform={transform}
        panMode={spaceHeld}
        onPointerDown={(e) => {
          if (contextMenu) setContextMenu(null)
          onPointerDown(e)
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onContextMenu={onContextMenu}
        plane={
          <>
            {groups.map((group) => {
              const members = images.filter((img) =>
                group.imageIds.includes(img.id),
              )
              if (members.length < 2) return null
              return (
                <GroupBackground
                  key={group.id}
                  groupId={group.id}
                  bounds={getBounds(members)}
                  padding={group.padding}
                />
              )
            })}
            {images.map((img) => (
              <ImageCard
                key={img.id}
                image={img}
                dimmed={isDimmed(img)}
                scale={transform.scale}
                onRetry={(id) => void canvasGen.retryFailed(id)}
                onDismiss={dismissFailed}
              />
            ))}
          </>
        }
      >
        {images
          .filter(
            (img) =>
              transform.scale >= MODEL_LABEL_MIN_SCALE &&
              !img.pending &&
              !img.failed &&
              img.model,
          )
          .map((img) => {
            const at = toScreen(img.x, img.y)
            return (
              <ModelLabel
                key={`label-${img.id}`}
                name={getModelName(img.model!)}
                left={at.left}
                top={at.top - MODEL_LABEL_OFFSET}
              />
            )
          })}

        {images
          .filter((img) => img.pending)
          .map((img) => {
            const at = toScreen(img.x + img.width / 2, img.y + img.height / 2)
            return (
              <PendingOverlay
                key={`loading-${img.id}`}
                left={at.left}
                top={at.top}
                modelName={
                  img.model && transform.scale > MODEL_LABEL_MIN_SCALE
                    ? getModelName(img.model)
                    : undefined
                }
              />
            )
          })}

        {selectionBounds && (
          <SelectionBounds
            left={
              transform.x +
              selectionBounds.x * transform.scale -
              SELECTION_INSET
            }
            top={
              transform.y +
              selectionBounds.y * transform.scale -
              SELECTION_INSET
            }
            width={selectionBounds.w * transform.scale + SELECTION_INSET * 2}
            height={selectionBounds.h * transform.scale + SELECTION_INSET * 2}
          />
        )}

        {showPill && selectionBounds && (
          <GeneratePill
            left={
              transform.x +
              (selectionBounds.x + selectionBounds.w / 2) * transform.scale
            }
            top={
              transform.y +
              (selectionBounds.y + selectionBounds.h) * transform.scale +
              PILL_GAP
            }
            count={pillImages.length}
            onClick={() => void canvasGen.open(pillImages)}
          />
        )}

        {marquee && (
          <MarqueeBox
            left={Math.min(marquee.x1, marquee.x2) - (containerRect?.left ?? 0)}
            top={Math.min(marquee.y1, marquee.y2) - (containerRect?.top ?? 0)}
            width={Math.abs(marquee.x2 - marquee.x1)}
            height={Math.abs(marquee.y2 - marquee.y1)}
          />
        )}

        {images.length === 0 && <EmptyPrompt />}

        <SelectionActions
          count={selected.size}
          isGrouped={!!getSelectedGroup()}
          onArrange={arrangeSelected}
          onGroup={groupSelected}
          onUngroup={ungroupSelected}
          zoomPct={Math.round(transform.scale * 100)}
          onUpload={() => fileInputRef.current?.click()}
          onLibrary={() => setLibraryOpen(true)}
        />

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={onFileChange}
          hidden
        />
      </CanvasSurface>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onGenerate={() => {
            const source = images.find((img) => img.id === contextMenu.imageId)
            if (source) void canvasGen.open([source])
            setContextMenu(null)
          }}
          onTrash={() => {
            const id = contextMenu.imageId
            setContextMenu(null)
            moveSelectionToTrash([id])
          }}
        />
      )}

      <CanvasGenerateDialog canvasGen={canvasGen} />

      <DeleteConfirm
        pending={deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onRemoveFromCanvas={removeSelectionFromCanvas}
        onMoveToTrash={moveSelectionToTrash}
      />

      <ExistingImagePicker
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        images={libraryImages}
        imageUrls={libraryImageUrls}
        isLoading={libraryLoading}
        alreadyCollectedIds={emptySet}
        onConfirm={onLibraryConfirm}
      />

      {dropNotice && <DropNotice message={dropNotice} />}
    </>
  )
}
