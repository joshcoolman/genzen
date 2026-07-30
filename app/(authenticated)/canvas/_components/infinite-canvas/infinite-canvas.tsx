'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
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
import {
  canRetryFailure,
  useCanvasGenerate,
} from '../canvas-generate-dialog/use-canvas-generate'
import { CANVAS_MAX_GROUP_SELECTION } from '../../_lib/canvas-models'
import { SelectionActions } from '../selection-actions/selection-actions'
import { CanvasGenerateDialog } from '../canvas-generate-dialog/canvas-generate-dialog'
import { ExistingImagePicker } from '../../../_components/existing-image-picker/existing-image-picker'
import styles from './infinite-canvas.module.css'
import type { CanvasGroup, CanvasImage, DragMode } from '../../_lib/types'
// Explicitly imported: `CanvasState` is also a lib.dom global, so without this
// the props type silently resolves to the DOM one.
import type { CanvasState } from '../../_lib/persistence'
import { getModelName } from '#/features/ai-images/models'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components'
import { useAuth } from '#/lib/auth'
import { useExistingImages } from '#/features/user-images'

interface InfiniteCanvasProps {
  /** The canvas as the server read it. Seeds the first render, so there is no
   *  loading gate and no empty first paint (#212). */
  initial: CanvasState
  className?: string
}

export function InfiniteCanvas({ initial, className }: InfiniteCanvasProps) {
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

  /* -- Render -- */

  const zoomPct = Math.round(transform.scale * 100)
  const rootClass = [styles.canvas, spaceHeld && styles.panMode, className]
    .filter(Boolean)
    .join(' ')
  // Bounding box for any selection (single or multi)
  const selectionBounds =
    selected.size >= 1
      ? getBounds(images.filter((img) => selected.has(img.id)))
      : null

  // Detect if current selection is exactly a group
  const selectedGroup = getSelectedGroup()
  const emptySet = useMemo(() => new Set<string>(), [])

  return (
    <>
      <div
        ref={containerRef}
        className={rootClass}
        onPointerDown={(e) => {
          // Close context menu on any click
          if (contextMenu) setContextMenu(null)
          onPointerDown(e)
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onContextMenu={(e) => {
          e.preventDefault()
          // A right-drag pan just ended -- don't pop the menu.
          if (suppressContextRef.current) {
            suppressContextRef.current = false
            return
          }
          const target = (e.target as HTMLElement).closest('[data-image-id]')
          const imageId = target?.getAttribute('data-image-id')
          if (imageId) {
            setContextMenu({ x: e.clientX, y: e.clientY, imageId })
          }
        }}
        tabIndex={0}
      >
        <div
          className={styles.inner}
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Group backgrounds (rendered behind images) */}
          {groups.map((group) => {
            const memberImgs = images.filter((img) =>
              group.imageIds.includes(img.id),
            )
            if (memberImgs.length < 2) return null
            const bounds = getBounds(memberImgs)
            const pad = group.padding
            return (
              <div
                key={group.id}
                data-group-id={group.id}
                className={styles.groupBackground}
                style={{
                  left: bounds.x - pad,
                  top: bounds.y - pad,
                  width: bounds.w + pad * 2,
                  height: bounds.h + pad * 2,
                }}
              />
            )
          })}

          {images.map((img) => (
            <div
              key={img.id}
              data-image-id={img.id}
              className={`${styles.image}${selected.size >= 2 && selectionBounds && !selected.has(img.id) && img.x + img.width >= selectionBounds.x && img.x <= selectionBounds.x + selectionBounds.w && img.y + img.height >= selectionBounds.y && img.y <= selectionBounds.y + selectionBounds.h ? ` ${styles.dimmed}` : ''}${img.pending ? ` ${styles.pending}` : ''}${img.failed ? ` ${styles.failed}` : ''}${selected.has(img.id) ? ` ${styles.selected}` : ''}`}
              style={{
                left: img.x,
                top: img.y,
                width: img.width,
                height: img.height,
              }}
            >
              {img.pending ? (
                <div className={styles.pendingInner} />
              ) : img.failed ? (
                <div className={styles.failedInner}>
                  <div
                    className={styles.failedContent}
                    style={{
                      transform: `scale(${Math.min(3, 1 / transform.scale)})`,
                    }}
                  >
                    <span className={styles.failedModel}>
                      {getModelName(img.model ?? '')}
                    </span>
                    <span className={styles.failedMsg}>
                      {img.errorMessage ?? 'Generation failed'}
                    </span>
                    <div className={styles.failedActions}>
                      {canRetryFailure(img) && (
                        <button
                          type="button"
                          className={styles.failedBtn}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation()
                            void canvasGen.retryFailed(img.id)
                          }}
                        >
                          Retry
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.failedBtnGhost}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation()
                          dismissFailed(img.id, img.recordId)
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <img src={img.signedUrl} alt="" draggable={false} />
              )}
            </div>
          ))}
        </div>

        {/* Model labels — screen-space overlay, same coordinate system as the
            Generate pill. Fixed screen size so they stay readable at any zoom. */}
        {images
          .filter(
            (img) =>
              transform.scale >= 0.1 &&
              !img.pending &&
              !img.failed &&
              img.model,
          )
          .map((img) => (
            <span
              key={`label-${img.id}`}
              className={styles.imageLabelOverlay}
              style={{
                left: transform.x + img.x * transform.scale,
                top: transform.y + img.y * transform.scale - 22,
              }}
            >
              {getModelName(img.model!)}
            </span>
          ))}

        {/* Loading indicator — screen-space overlay centered on each pending
            tile. Fixed readable size at any zoom (matches the labels + Generate
            pill); the gray placeholder stays in-plane and scales with the tile. */}
        {images
          .filter((img) => img.pending)
          .map((img) => (
            <div
              key={`loading-${img.id}`}
              className={styles.pendingOverlay}
              style={{
                left: transform.x + (img.x + img.width / 2) * transform.scale,
                top: transform.y + (img.y + img.height / 2) * transform.scale,
              }}
            >
              <div className={styles.pendingSpinner} />
              {img.model && transform.scale > 0.1 && (
                <span className={styles.pendingModel}>
                  {getModelName(img.model)}
                </span>
              )}
            </div>
          ))}

        {selectionBounds && (
          <div
            className={styles.groupBounds}
            style={{
              left: transform.x + selectionBounds.x * transform.scale - 6,
              top: transform.y + selectionBounds.y * transform.scale - 6,
              width: selectionBounds.w * transform.scale + 12,
              height: selectionBounds.h * transform.scale + 12,
            }}
          />
        )}

        {/* Generate affordance: appears below the selection when 1..GROUP_MAX
            non-pending images are selected. One image -> single Generate dialog;
            a group -> the multi-image Generate dialog (all images as references).
            More than GROUP_MAX selected -> no pill (no model can hold the group). */}
        {selected.size >= 1 &&
          selected.size <= CANVAS_MAX_GROUP_SELECTION &&
          selectionBounds &&
          !canvasGen.isOpen &&
          (() => {
            const selectedImgs = images.filter((img) => selected.has(img.id))
            if (
              selectedImgs.length !== selected.size ||
              selectedImgs.some((img) => img.pending)
            )
              return null
            const isGroup = selectedImgs.length > 1
            return (
              <button
                className={styles.onImageGenerate}
                style={{
                  left:
                    transform.x +
                    (selectionBounds.x + selectionBounds.w / 2) *
                      transform.scale,
                  top:
                    transform.y +
                    (selectionBounds.y + selectionBounds.h) * transform.scale +
                    10,
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  void canvasGen.open(selectedImgs)
                }}
                title={
                  isGroup
                    ? `Generate from ${selectedImgs.length} images`
                    : 'Generate from image'
                }
              >
                <Sparkles size={15} />
                <span>Generate</span>
              </button>
            )
          })()}

        {marquee &&
          (() => {
            const rect = containerRef.current?.getBoundingClientRect()
            const ox = rect?.left ?? 0
            const oy = rect?.top ?? 0
            return (
              <div
                className={styles.marquee}
                style={{
                  left: Math.min(marquee.x1, marquee.x2) - ox,
                  top: Math.min(marquee.y1, marquee.y2) - oy,
                  width: Math.abs(marquee.x2 - marquee.x1),
                  height: Math.abs(marquee.y2 - marquee.y1),
                }}
              />
            )
          })()}

        {images.length === 0 && (
          <div className={styles.empty}>
            <p>Drop images here, paste from clipboard, or use the + button</p>
            <p className={styles.emptyHint}>
              Click to set paste target &middot; Scroll to zoom &middot;
              Space+drag to pan
            </p>
          </div>
        )}

        <SelectionActions
          count={selected.size}
          isGrouped={!!selectedGroup}
          onArrange={arrangeSelected}
          onGroup={groupSelected}
          onUngroup={ungroupSelected}
          zoomPct={zoomPct}
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
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            className={styles.contextMenuItem}
            onClick={() => {
              const sourceImage = images.find(
                (img) => img.id === contextMenu.imageId,
              )
              if (sourceImage) void canvasGen.open([sourceImage])
              setContextMenu(null)
            }}
          >
            Generate
          </button>
          <button
            className={`${styles.contextMenuItem} ${styles.contextMenuItemDanger}`}
            onClick={() => {
              const id = contextMenu.imageId
              setContextMenu(null)
              moveSelectionToTrash([id])
            }}
          >
            Move to Trash
          </button>
        </div>
      )}

      <CanvasGenerateDialog canvasGen={canvasGen} />

      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <DialogContent className={styles.confirmPopup}>
          <DialogHeader>
            <DialogTitle>
              {deleteConfirm && deleteConfirm.ids.length > 1
                ? `Delete ${deleteConfirm.ids.length} images?`
                : 'Delete this image?'}
            </DialogTitle>
            <DialogDescription>
              Remove it from the canvas (it stays in your library), or move it
              to Trash.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={styles.confirmFooter}>
            <Button
              variant="secondary"
              className={styles.confirmAction}
              onClick={() => {
                if (deleteConfirm) removeSelectionFromCanvas(deleteConfirm.ids)
                setDeleteConfirm(null)
              }}
            >
              Remove from Canvas
            </Button>
            <Button
              variant="danger"
              className={styles.confirmAction}
              onClick={() => {
                if (deleteConfirm) moveSelectionToTrash(deleteConfirm.ids)
                setDeleteConfirm(null)
              }}
            >
              Move to Trash
            </Button>
            <Button
              variant="ghost"
              className={styles.confirmAction}
              onClick={() => setDeleteConfirm(null)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExistingImagePicker
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        images={libraryImages}
        imageUrls={libraryImageUrls}
        isLoading={libraryLoading}
        alreadyCollectedIds={emptySet}
        onConfirm={onLibraryConfirm}
      />

      {dropNotice && (
        <div key={dropNotice} className={styles.dropNotice}>
          {dropNotice}
        </div>
      )}
    </>
  )
}
