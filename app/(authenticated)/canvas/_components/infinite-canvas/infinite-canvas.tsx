'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import hotkeys from 'hotkeys-js'
import { Sparkles } from 'lucide-react'
import {
  addToCanvas,
  getImageDimensions,
  getSignedUrl,
  getUrlDimensions,
  moveToTrash,
  removeFromCanvas,
  restoreFromTrash,
  saveCanvas,
  stateToImages,
} from '../../_lib/persistence'
import { layoutMasonry } from '../../_lib/masonry'
import {
  DEFAULT_SCALE,
  MAX_SCALE,
  MIN_SCALE,
  centerOn,
  getBounds,
  scaleToFit,
  spatialSort,
} from '../../_lib/geometry'
import {
  canRetryFailure,
  useCanvasGenerate,
} from '../canvas-generate-dialog/use-canvas-generate'
import { CANVAS_MAX_GROUP_SELECTION } from '../../_lib/canvas-models'
import { SelectionActions } from '../selection-actions/selection-actions'
import { CanvasGenerateDialog } from '../canvas-generate-dialog/canvas-generate-dialog'
import { ExistingImagePicker } from '../../../_components/existing-image-picker/existing-image-picker'
import styles from './infinite-canvas.module.css'
import type {
  CanvasGroup,
  CanvasImage,
  DragMode,
  Transform,
} from '../../_lib/types'
// Explicitly imported: `CanvasState` is also a lib.dom global, so without this
// the props type silently resolves to the DOM one.
import type { CanvasState } from '../../_lib/persistence'
import type { CollectedImage } from '#/features/user-images'
import { getModelName } from '#/features/ai-images/models'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from '#/components'
import { useAuth } from '#/lib/auth'
import { useExistingImages } from '#/features/user-images'
import { computeFileHash } from '#/features/user-images/lib/file-hash'

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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [transform, setTransform] = useState<Transform>(
    initial.transform ?? { x: 0, y: 0, scale: DEFAULT_SCALE },
  )
  const [marquee, setMarquee] = useState<{
    x1: number
    y1: number
    x2: number
    y2: number
  } | null>(null)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [dropNotice, setDropNotice] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    imageId: string
  } | null>(null)
  // Pending delete awaiting the confirm modal's choice.
  const [deleteConfirm, setDeleteConfirm] = useState<{
    ids: Array<string>
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

  const tRef = useRef(transform)
  const iRef = useRef(images)
  const sRef = useRef(selected)
  const gRef = useRef(groups)
  const spaceRef = useRef(false)
  // Right-button drag pans the canvas. Track it so a right-drag suppresses the
  // context menu while a plain right-click still opens it.
  const rightPanRef = useRef(false)
  const suppressContextRef = useRef(false)
  const pasteTargetRef = useRef<{ x: number; y: number } | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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

  /* -- Undo / Redo -- */
  const undoStack = useRef<
    Array<{ images: Array<CanvasImage>; groups: Array<CanvasGroup> }>
  >([])
  const redoStack = useRef<
    Array<{ images: Array<CanvasImage>; groups: Array<CanvasGroup> }>
  >([])
  const MAX_UNDO = 50

  const pushUndo = useCallback(() => {
    undoStack.current.push({ images: iRef.current, groups: gRef.current })
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift()
    redoStack.current = []
  }, [])

  // Bridge: fitBounds is defined later in the component, but useCanvasGenerate
  // needs to reveal newly-placed previews. Route through a ref set below.
  const fitBoundsRef = useRef<
    ((b: { x: number; y: number; w: number; h: number }) => void) | null
  >(null)
  const revealBounds = useCallback(
    (b: { x: number; y: number; w: number; h: number }) =>
      fitBoundsRef.current?.(b),
    [],
  )
  const getImages = useCallback(() => iRef.current, [])

  // Wrap already-positioned images in a group without re-arranging them (unlike
  // groupSelected, which masonry-arranges). Used to auto-group a generation's
  // origin with its previews.
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
    [],
  )

  const canvasGen = useCanvasGenerate(
    setImages,
    pushUndo,
    getImages,
    revealBounds,
    groupImages,
  )

  const undo = useCallback(() => {
    const entry = undoStack.current.pop()
    if (!entry) return
    redoStack.current.push({ images: iRef.current, groups: gRef.current })
    setImages(entry.images)
    setGroups(entry.groups)
    iRef.current = entry.images
    gRef.current = entry.groups
  }, [])

  const redo = useCallback(() => {
    const entry = redoStack.current.pop()
    if (!entry) return
    undoStack.current.push({ images: iRef.current, groups: gRef.current })
    setImages(entry.images)
    setGroups(entry.groups)
    iRef.current = entry.images
    gRef.current = entry.groups
  }, [])

  // Strip images off the canvas locally (images, groups, selection). Does not
  // touch the DB or undo stack -- callers handle membership / deleted_at + undo.
  const stripFromCanvas = useCallback((idSet: Set<string>) => {
    setImages((prev) => prev.filter((img) => !idSet.has(img.id)))
    setGroups((prev) =>
      prev
        .map((g) => ({
          ...g,
          imageIds: g.imageIds.filter((id) => !idSet.has(id)),
        }))
        .filter((g) => g.imageIds.length >= 2),
    )
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of idSet) next.delete(id)
      sRef.current = next
      return next
    })
  }, [])

  // "Remove from Canvas": canvas-only removal (row kept in the library).
  const removeSelectionFromCanvas = useCallback(
    (ids: Array<string>) => {
      if (ids.length === 0) return
      const idSet = new Set(ids)
      const recordIds = iRef.current
        .filter((img) => idSet.has(img.id) && img.recordId)
        .map((img) => img.recordId)
      pushUndo()
      void removeFromCanvas(canvasId, recordIds)
      stripFromCanvas(idSet)
      toast(
        ids.length === 1
          ? 'Removed from canvas'
          : `Removed ${ids.length} from canvas`,
        { duration: 6000, action: { label: 'Undo', onClick: () => undo() } },
      )
    },
    [pushUndo, undo, stripFromCanvas, canvasId],
  )

  // "Move to Trash": soft-delete, which is a library operation. Membership is
  // deliberately kept (#212) -- the card comes off screen because the canvas read
  // filters `deleted_at`, and restoring puts it back at the same position instead
  // of making the user re-arrange it.
  const moveSelectionToTrash = useCallback(
    (ids: Array<string>) => {
      if (ids.length === 0) return
      const idSet = new Set(ids)
      const removed = iRef.current.filter((img) => idSet.has(img.id))
      const recordIds = removed
        .filter((img) => img.recordId)
        .map((img) => img.recordId)
      pushUndo()
      stripFromCanvas(idSet)
      void moveToTrash(recordIds)
        .then(() =>
          toast.success(
            ids.length === 1
              ? 'Moved to Trash'
              : `Moved ${ids.length} to Trash`,
            {
              duration: 6000,
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
    [pushUndo, stripFromCanvas],
  )

  useEffect(() => {
    tRef.current = transform
  }, [transform])
  useEffect(() => {
    iRef.current = images
  }, [images])
  useEffect(() => {
    sRef.current = selected
  }, [selected])
  useEffect(() => {
    gRef.current = groups
  }, [groups])
  useEffect(() => {
    dialogOpenRef.current = canvasGen.isOpen || libraryOpen
  }, [canvasGen.isOpen, libraryOpen])

  /* -- Place what is unplaced --
     The only reconcile rule left. A membership row can arrive without a
     position -- a generation's row is written the moment it is reserved,
     server-side, before any client has decided where the card goes -- and this
     lays those out beside whatever is already placed. There is nothing to
     reclaim (the rows *are* the membership) and nothing to prune (a row cannot
     outlive its image), which is what the foreign key bought. */

  const placedRef = useRef(false)
  useEffect(() => {
    if (placedRef.current) return
    placedRef.current = true

    const unplaced = initial.images.filter((row) =>
      seed.unplacedIds.has(row.image_id),
    )
    const pending = initial.images
      .filter((row) => row.status === 'pending')
      .map((row) => ({ id: row.image_id, recordId: row.image_id }))

    if (unplaced.length === 0) {
      if (pending.length > 0) canvasGen.resumePending(pending)
      return
    }

    void (async () => {
      // Beside the existing arrangement, so a reclaimed generation never lands
      // on top of work already on the canvas.
      const placedImages = seed.images.filter(
        (img) => !seed.unplacedIds.has(img.id),
      )
      let originX = 0
      let originY = 0
      if (placedImages.length > 0) {
        originX = Math.max(...placedImages.map((i) => i.x + i.width)) + 400
        originY = Math.min(...placedImages.map((i) => i.y))
      }

      // Real dimensions for anything with an image; the declared aspect ratio
      // for a generation that has not produced one yet.
      const sized = await Promise.all(
        unplaced.map(async (row) => {
          if (row.url) {
            const dims = await getUrlDimensions(row.url)
            return { id: row.image_id, width: dims.w, height: dims.h }
          }
          const ratio =
            (row.generation_metadata?.aspect_ratio as string | undefined) ??
            '1:1'
          const [w, h] = ratio.split(':').map(Number)
          const height = 300
          return {
            id: row.image_id,
            width: Math.round(height * (w && h ? w / h : 1)),
            height,
          }
        }),
      )

      const placed = new Map(
        layoutMasonry(sized, 6, originX, originY, 300).map((p) => [p.id, p]),
      )

      setImages((prev) =>
        prev.map((img) => {
          const p = placed.get(img.id)
          return p
            ? { ...img, x: p.x, y: p.y, width: p.width, height: p.height }
            : img
        }),
      )

      if (pending.length > 0) canvasGen.resumePending(pending)
    })()
  }, [initial.images, seed, canvasGen])

  /* -- Save state (debounced) -- */

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    void saveCanvas(canvasId, {
      images: iRef.current,
      transform: tRef.current,
      groups: gRef.current,
    })
  }, [canvasId])

  // Positions, viewport and groupings only. Membership is never inferred from
  // this state, so a save cannot evict a generation whose row was written while
  // the tab was in the background -- which is what the diff-based
  // `syncCanvasFlags` it replaces could do.
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void saveCanvas(canvasId, { images, transform, groups })
    }, 500)
  }, [images, transform, groups, canvasId])

  // Flush the pending save on navigation (unmount) and page unload (reload, tab
  // close, app switch) so a debounce window never loses the latest layout.
  useEffect(() => {
    const onHide = () => flushSave()
    const onVis = () => {
      if (document.visibilityState === 'hidden') flushSave()
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVis)
      flushSave()
    }
  }, [flushSave])

  /* -- Coordinates -- */

  const screenToCanvas = useCallback((sx: number, sy: number) => {
    const r = containerRef.current?.getBoundingClientRect()
    if (!r) return { x: 0, y: 0 }
    const t = tRef.current
    return { x: (sx - r.left - t.x) / t.scale, y: (sy - r.top - t.y) / t.scale }
  }, [])

  const viewportCenter = useCallback(() => {
    const r = containerRef.current?.getBoundingClientRect()
    if (!r) return { x: 0, y: 0 }
    return screenToCanvas(r.left + r.width / 2, r.top + r.height / 2)
  }, [screenToCanvas])

  const getPasteTarget = useCallback(() => {
    return pasteTargetRef.current ?? viewportCenter()
  }, [viewportCenter])

  /* -- Group helpers -- */

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
  }, [])

  const arrangeSelected = useCallback(
    (columns: number) => {
      const sel = sRef.current
      if (sel.size < 2) return
      pushUndo()
      const selImgs = iRef.current.filter((img) => sel.has(img.id))
      const sorted = spatialSort(selImgs)
      const bounds = getBounds(selImgs)
      const centerX = bounds.x + bounds.w / 2
      const originY = bounds.y

      const items = sorted.map((img) => ({
        id: img.id,
        width: img.width,
        height: img.height,
      }))
      const results = layoutMasonry(items, columns, centerX, originY)

      const posMap = new Map(results.map((r) => [r.id, r]))
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
    [pushUndo],
  )

  const groupSelected = useCallback(
    (columns: number) => {
      const sel = sRef.current
      if (sel.size < 2) return
      pushUndo()

      // Remove selected images from any existing groups first
      const selArr = [...sel]
      setGroups((prev) => {
        let next = prev
          .map((g) => ({
            ...g,
            imageIds: g.imageIds.filter((id) => !sel.has(id)),
          }))
          .filter((g) => g.imageIds.length >= 2)

        // Arrange first (spatial sort to preserve rough layout order)
        const selImgs = spatialSort(
          iRef.current.filter((img) => sel.has(img.id)),
        )
        const bounds = getBounds(selImgs)
        const centerX = bounds.x + bounds.w / 2
        const originY = bounds.y
        const items = selImgs.map((img) => ({
          id: img.id,
          width: img.width,
          height: img.height,
        }))
        const results = layoutMasonry(items, columns, centerX, originY)
        const posMap = new Map(results.map((r) => [r.id, r]))

        setImages((currentImages) =>
          currentImages.map((img) => {
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

        next = [
          ...next,
          {
            id: crypto.randomUUID(),
            imageIds: selArr,
            columns,
            padding: 24,
          },
        ]
        return next
      })
    },
    [pushUndo],
  )

  const ungroupSelected = useCallback(() => {
    const sel = sRef.current
    pushUndo()
    // Remove any groups that overlap with the selection
    setGroups((prev) =>
      prev.filter((g) => !g.imageIds.some((id) => sel.has(id))),
    )
  }, [pushUndo])

  /* -- Image loading -- */

  const addImagesFromFiles = useCallback(
    async (files: FileList | Array<File>, cx: number, cy: number) => {
      const imageFiles = Array.from(files).filter((f) =>
        f.type.startsWith('image/'),
      )
      if (imageFiles.length === 0) return

      // Get dimensions from object URLs (instant, no upload needed)
      const withDims = await Promise.all(
        imageFiles.map(async (file) => ({
          file,
          dims: await getImageDimensions(file),
        })),
      )

      // Create pending placeholders with proper masonry layout
      const items = withDims.map(({ dims }) => ({
        id: crypto.randomUUID(),
        width: dims.w,
        height: dims.h,
      }))
      const layoutResults = layoutMasonry(
        items,
        6,
        cx,
        cy,
        items.length === 1 ? undefined : 300,
      )
      const pendingImages: Array<CanvasImage> = layoutResults.map((r) => ({
        ...r,
        recordId: '',
        storagePath: '',
        pending: true,
      }))

      pushUndo()
      setImages((prev) => [...prev, ...pendingImages])
      const newIds = new Set(pendingImages.map((img) => img.id))
      setSelected(newIds)
      sRef.current = newIds

      // Upload all files in parallel, replacing placeholders as they complete
      await Promise.all(
        withDims.map(async ({ file }, i) => {
          const placeholder = pendingImages[i]
          try {
            const fileHash = await computeFileHash(file)
            const record = await canvasGen.userImages.create({
              title: file.name || 'Canvas Image',
              file,
              file_hash: fileHash,
            })
            if (!record.storage_path) {
              throw new Error('Created image is missing a storage path')
            }
            const storagePath = record.storage_path

            const signedUrl = await getSignedUrl(storagePath)
            if (!signedUrl) throw new Error('Failed to get signed URL')

            setImages((prev) =>
              prev.map((ci) =>
                ci.id === placeholder.id
                  ? {
                      ...ci,
                      recordId: record.id,
                      storagePath,
                      signedUrl,
                      pending: false,
                    }
                  : ci,
              ),
            )
            // Membership *and* position, eagerly: the placeholder was already
            // laid out, so the card is reclaimable at the right spot even if the
            // page reloads before the debounced save runs.
            void addToCanvas(canvasId, [
              {
                imageId: record.id,
                x: placeholder.x,
                y: placeholder.y,
                width: placeholder.width,
                height: placeholder.height,
              },
            ])
          } catch {
            setImages((prev) => prev.filter((ci) => ci.id !== placeholder.id))
          }
        }),
      )
    },
    [pushUndo, canvasGen.userImages, canvasId],
  )

  /* -- Library picker confirm -- */

  const onLibraryConfirm = useCallback(
    async (selectedImages: Array<CollectedImage>) => {
      if (selectedImages.length === 0) return
      const c = getPasteTarget()

      // Look up storage_path from libraryImages and get full-res signed URLs
      const resolved = await Promise.all(
        selectedImages.map(async (item) => {
          const record = libraryImages.find((img) => img.id === item.id)
          if (!record?.storage_path) return null
          const signedUrl = await getSignedUrl(record.storage_path)
          if (!signedUrl) return null

          // Get dimensions from the full-res URL
          const dims = await new Promise<{ w: number; h: number }>(
            (resolve) => {
              const img = new Image()
              img.onload = () =>
                resolve({ w: img.naturalWidth, h: img.naturalHeight })
              img.onerror = () => resolve({ w: 300, h: 300 })
              img.src = signedUrl
            },
          )
          return {
            recordId: record.id,
            storagePath: record.storage_path,
            signedUrl,
            ...dims,
          }
        }),
      )

      const valid = resolved.filter(
        (
          r,
        ): r is {
          recordId: string
          storagePath: string
          signedUrl: string
          w: number
          h: number
        } => r !== null,
      )
      if (valid.length === 0) return

      const items = valid.map(({ w, h }) => ({
        id: crypto.randomUUID(),
        width: w,
        height: h,
      }))
      const results = layoutMasonry(
        items,
        6,
        c.x,
        c.y,
        items.length === 1 ? undefined : 300,
      )

      const newImages: Array<CanvasImage> = results.map((r, i) => ({
        ...r,
        recordId: valid[i].recordId,
        storagePath: valid[i].storagePath,
        signedUrl: valid[i].signedUrl,
      }))

      const newIds = new Set(newImages.map((img) => img.id))
      pushUndo()
      setImages((prev) => [...prev, ...newImages])
      setSelected(newIds)
      sRef.current = newIds
      void addToCanvas(
        canvasId,
        newImages.map((img) => ({
          imageId: img.recordId,
          x: img.x,
          y: img.y,
          width: img.width,
          height: img.height,
        })),
      )
    },
    [pushUndo, getPasteTarget, libraryImages, canvasId],
  )

  /* -- Zoom -- */

  const zoomAt = useCallback((newScale: number, sx: number, sy: number) => {
    setTransform((prev) => {
      const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale))
      const r = s / prev.scale
      return { x: sx - (sx - prev.x) * r, y: sy - (sy - prev.y) * r, scale: s }
    })
  }, [])

  const zoomCenter = useCallback(
    (newScale: number) => {
      const r = containerRef.current?.getBoundingClientRect()
      if (!r) return
      zoomAt(newScale, r.left + r.width / 2, r.top + r.height / 2)
    },
    [zoomAt],
  )

  const fitBounds = useCallback(
    (bounds: { x: number; y: number; w: number; h: number }) => {
      const r = containerRef.current?.getBoundingClientRect()
      if (!r || bounds.w === 0 || bounds.h === 0) return
      setTransform(centerOn(bounds, r, scaleToFit(bounds, r, { pad: 60 })))
    },
    [],
  )
  // Let useCanvasGenerate reveal newly-placed previews (see revealBounds above).
  fitBoundsRef.current = fitBounds

  /* -- Wheel zoom -- */

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const t = tRef.current
      const sensitivity = e.ctrlKey ? 0.01 : 0.002
      const delta = -e.deltaY * sensitivity
      const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale * (1 + delta)))
      const r = ns / t.scale
      const nt = {
        x: e.clientX - (e.clientX - t.x) * r,
        y: e.clientY - (e.clientY - t.y) * r,
        scale: ns,
      }
      tRef.current = nt
      setTransform(nt)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  /* -- Space key for pan mode -- */

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (
        dialogOpenRef.current ||
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT'
      )
        return
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        spaceRef.current = true
        setSpaceHeld(true)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceRef.current = false
        setSpaceHeld(false)
      }
    }
    document.addEventListener('keydown', down)
    document.addEventListener('keyup', up)
    return () => {
      document.removeEventListener('keydown', down)
      document.removeEventListener('keyup', up)
    }
  }, [])

  /* -- Paste -- */

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      // Extract clipboard image file (works for screenshots, copies, HTML img pastes)
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (!file) continue
          e.preventDefault()
          const c = getPasteTarget()
          addImagesFromFiles([file], c.x, c.y)
          return
        }
      }

      // Fall back to pasted URL text -- fetch and upload as file
      const text = e.clipboardData.getData('text/plain')
      if (text.match(/\.(png|jpg|jpeg|gif|webp|svg|bmp)(\?.*)?$/i)) {
        e.preventDefault()
        const c = getPasteTarget()
        fetch(text)
          .then((r) => r.blob())
          .then((blob) => {
            const file = new File([blob], 'pasted-image.png', {
              type: blob.type || 'image/png',
            })
            addImagesFromFiles([file], c.x, c.y)
          })
          .catch(() => {
            /* URL not fetchable -- skip */
          })
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [addImagesFromFiles, getPasteTarget])

  /* -- Drop -- */

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const pos = screenToCanvas(e.clientX, e.clientY)

      if (e.dataTransfer.files.length > 0) {
        addImagesFromFiles(e.dataTransfer.files, pos.x, pos.y)
        return
      }

      // Try to fetch dropped URL as a file and upload
      const html = e.dataTransfer.getData('text/html')
      const urlMatch = html.match(/<img[^>]+src="([^"]+)"/)
      const url = urlMatch?.[1] || e.dataTransfer.getData('text/plain') || ''

      if (url.startsWith('http')) {
        fetch(url)
          .then((r) => r.blob())
          .then((blob) => {
            const file = new File([blob], 'dropped-image.png', {
              type: blob.type || 'image/png',
            })
            addImagesFromFiles([file], pos.x, pos.y)
          })
          .catch(() => {
            setDropNotice(
              "Couldn't load that image. Try copying it and pasting instead.",
            )
            setTimeout(() => setDropNotice(null), 3000)
          })
      }
    },
    [screenToCanvas, addImagesFromFiles],
  )

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
        setSelected(next)
        sRef.current = next
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
          setSelected((prev) => {
            const next = new Set(prev)
            const allIn = group.imageIds.every((id) => next.has(id))
            if (allIn) {
              group.imageIds.forEach((id) => next.delete(id))
            } else {
              group.imageIds.forEach((id) => next.add(id))
            }
            sRef.current = next
            return next
          })
        } else {
          setSelected((prev) => {
            const next = new Set(prev)
            next.has(imageId) ? next.delete(imageId) : next.add(imageId)
            sRef.current = next
            return next
          })
        }
      } else if (group) {
        // Click on grouped image: select entire group
        if (!group.imageIds.every((id) => sRef.current.has(id))) {
          const next = new Set(group.imageIds)
          setSelected(next)
          sRef.current = next
        }
      } else if (!sRef.current.has(imageId)) {
        const next = new Set([imageId])
        setSelected(next)
        sRef.current = next
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
        const t = tRef.current
        const nt = {
          x: t.x + e.clientX - d.sx,
          y: t.y + e.clientY - d.sy,
          scale: t.scale,
        }
        tRef.current = nt
        setTransform(nt)
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
          setSelected((prev) => {
            const m = new Set(prev)
            hit.forEach((id) => m.add(id))
            sRef.current = m
            return m
          })
        } else {
          setSelected(hit)
          sRef.current = hit
        }
        setMarquee(null)
      } else if (d.mode === 'marquee' && !d.moved) {
        pasteTargetRef.current = screenToCanvas(e.clientX, e.clientY)
        setSelected(new Set())
        sRef.current = new Set()
        setMarquee(null)
      }
      dragRef.current = { mode: null, sx: 0, sy: 0, moved: false }
    },
    [screenToCanvas],
  )

  /* -- Hotkeys -- */

  useEffect(() => {
    hotkeys.filter = () => !dialogOpenRef.current

    hotkeys('command+=,command+plus', (e) => {
      e.preventDefault()
      zoomCenter(tRef.current.scale * 1.25)
    })
    hotkeys('command+-', (e) => {
      e.preventDefault()
      zoomCenter(tRef.current.scale / 1.25)
    })

    hotkeys('command+0', (e) => {
      e.preventDefault()
      const sel = sRef.current,
        imgs = iRef.current
      const targets = sel.size > 0 ? imgs.filter((i) => sel.has(i.id)) : imgs
      if (targets.length === 0) return
      // Fit selection to 75% of viewport (comfortable focus, not edge-to-edge)
      const b = getBounds(targets)
      const r = containerRef.current?.getBoundingClientRect()
      if (!r) return
      setTransform(centerOn(b, r, scaleToFit(b, r, { fill: 0.75 })))
    })

    hotkeys('command+shift+0', (e) => {
      e.preventDefault()
      if (iRef.current.length === 0) return
      fitBounds(getBounds(iRef.current))
    })

    hotkeys('command+1', (e) => {
      e.preventDefault()
      zoomCenter(1.0)
    })

    hotkeys('command+2', (e) => {
      e.preventDefault()
      const sel = sRef.current,
        imgs = iRef.current
      const targets = sel.size > 0 ? imgs.filter((i) => sel.has(i.id)) : imgs
      if (targets.length === 0) return
      fitBounds(getBounds(targets))
    })

    hotkeys('backspace,delete', (e) => {
      e.preventDefault()
      if (sRef.current.size === 0) return
      // Surface an explicit choice instead of silently removing (the toast was
      // too easy to miss). The modal offers remove-from-canvas vs move-to-trash.
      setDeleteConfirm({ ids: [...sRef.current] })
    })

    hotkeys('command+a', (e) => {
      e.preventDefault()
      const all = new Set(iRef.current.map((i) => i.id))
      setSelected(all)
      sRef.current = all
    })

    hotkeys('escape', () => {
      setSelected(new Set())
      sRef.current = new Set()
    })

    hotkeys('command+z', (e) => {
      e.preventDefault()
      undo()
    })

    hotkeys('command+shift+z', (e) => {
      e.preventDefault()
      redo()
    })

    hotkeys('command+g', (e) => {
      e.preventDefault()
      if (sRef.current.size >= 2) groupSelected(4)
    })

    hotkeys('command+shift+g', (e) => {
      e.preventDefault()
      ungroupSelected()
    })

    return () => {
      hotkeys.unbind('command+=,command+plus')
      hotkeys.unbind('command+-')
      hotkeys.unbind('command+0')
      hotkeys.unbind('command+1')
      hotkeys.unbind('command+2')
      hotkeys.unbind('command+shift+0')
      hotkeys.unbind('backspace,delete')
      hotkeys.unbind('command+a')
      hotkeys.unbind('escape')
      hotkeys.unbind('command+z')
      hotkeys.unbind('command+shift+z')
      hotkeys.unbind('command+g')
      hotkeys.unbind('command+shift+g')
    }
  }, [
    zoomCenter,
    fitBounds,
    groupSelected,
    ungroupSelected,
    undo,
    redo,
    pushUndo,
  ])

  /* -- File input -- */

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.length) return
      const c = getPasteTarget()
      addImagesFromFiles(e.target.files, c.x, c.y)
      e.target.value = ''
    },
    [addImagesFromFiles, getPasteTarget],
  )

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
                          if (img.recordId)
                            void removeFromCanvas(canvasId, [img.recordId])
                          setImages((prev) =>
                            prev.filter((ci) => ci.id !== img.id),
                          )
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
