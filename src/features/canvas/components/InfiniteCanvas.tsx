import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import hotkeys from 'hotkeys-js'
import {
  getImageDimensions,
  getSignedUrl,
  loadPersistedState,
  resolveSignedUrls,
  savePersistedState,
} from '../lib/persistence'
import { layoutMasonry } from '../lib/masonry'
import { useCanvasGenerate } from '../hooks/use-canvas-generate'
import { SelectionActions } from './SelectionActions'
import { CanvasGenerateDialog } from './CanvasGenerateDialog'
import styles from './InfiniteCanvas.module.css'
import type { CanvasGroup, CanvasImage, DragMode, Transform } from '../types'
import type { CollectedImage } from '@/features/user-images'
import { useAuth } from '@/lib/auth'
import { ExistingImagePicker, useExistingImages } from '@/features/user-images'
import { computeFileHash } from '@/features/user-images/lib/file-hash'

interface InfiniteCanvasProps {
  storageKey?: string
  className?: string
}

const MIN_SCALE = 0.02
const MAX_SCALE = 1.0
const DEFAULT_SCALE = 0.5

/** Sort images in reading order (top-to-bottom, left-to-right) to preserve
 *  the rough spatial layout the user arranged before grouping/arranging. */
function spatialSort(imgs: Array<CanvasImage>): Array<CanvasImage> {
  if (imgs.length < 2) return imgs
  const sorted = [...imgs].sort((a, b) => a.y - b.y)
  // Use half the average height as the row tolerance
  const avgH = imgs.reduce((s, i) => s + i.height, 0) / imgs.length
  const rowTolerance = avgH * 0.5
  // Group into rows, then sort each row left-to-right
  const rows: Array<Array<CanvasImage>> = []
  let currentRow: Array<CanvasImage> = [sorted[0]]
  let rowY = sorted[0].y
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].y - rowY <= rowTolerance) {
      currentRow.push(sorted[i])
    } else {
      rows.push(currentRow.sort((a, b) => a.x - b.x))
      currentRow = [sorted[i]]
      rowY = sorted[i].y
    }
  }
  rows.push(currentRow.sort((a, b) => a.x - b.x))
  return rows.flat()
}

function getBounds(imgs: Array<CanvasImage>) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity
  for (const img of imgs) {
    x0 = Math.min(x0, img.x)
    y0 = Math.min(y0, img.y)
    x1 = Math.max(x1, img.x + img.width)
    y1 = Math.max(y1, img.y + img.height)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

export function InfiniteCanvas({
  storageKey = 'canvas',
  className,
}: InfiniteCanvasProps) {
  const [images, setImages] = useState<Array<CanvasImage>>([])
  const [groups, setGroups] = useState<Array<CanvasGroup>>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [transform, setTransform] = useState<Transform>({
    x: 0,
    y: 0,
    scale: DEFAULT_SCALE,
  })
  const [marquee, setMarquee] = useState<{
    x1: number
    y1: number
    x2: number
    y2: number
  } | null>(null)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [dropNotice, setDropNotice] = useState<string | null>(null)
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
  } = useExistingImages(user?.id)

  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const tRef = useRef(transform)
  const iRef = useRef(images)
  const sRef = useRef(selected)
  const gRef = useRef(groups)
  const spaceRef = useRef(false)
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

  const canvasGen = useCanvasGenerate(setImages, pushUndo)

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

  /* -- Load persisted state -- */

  useEffect(() => {
    loadPersistedState(storageKey).then(async (state) => {
      if (state) {
        setImages(state.images)
        setTransform(state.transform)
        setGroups(state.groups ?? [])
        tRef.current = state.transform
        iRef.current = state.images
        gRef.current = state.groups ?? []

        // Resolve signed URLs for persisted images (they expire and aren't stored)
        if (state.images.length > 0) {
          const resolved = await resolveSignedUrls(state.images)
          setImages(resolved)
          iRef.current = resolved
        }
      }
      setLoaded(true)
    })
  }, [storageKey])

  /* -- Save state (debounced) -- */

  useEffect(() => {
    if (!loaded) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      savePersistedState({ images, transform, groups }, storageKey)
    }, 500)
  }, [images, transform, groups, loaded, storageKey])

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
      const layoutResults = layoutMasonry(items, 6, cx, cy, 300)
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

            const signedUrl = await getSignedUrl(record.storage_path)
            if (!signedUrl) throw new Error('Failed to get signed URL')

            setImages((prev) =>
              prev.map((ci) =>
                ci.id === placeholder.id
                  ? {
                      ...ci,
                      recordId: record.id,
                      storagePath: record.storage_path,
                      signedUrl,
                      pending: false,
                    }
                  : ci,
              ),
            )
          } catch {
            setImages((prev) => prev.filter((ci) => ci.id !== placeholder.id))
          }
        }),
      )
    },
    [pushUndo, canvasGen.userImages],
  )

  /* -- Library picker confirm -- */

  const onLibraryConfirm = useCallback(
    async (selected: Array<CollectedImage>) => {
      if (selected.length === 0) return
      const c = getPasteTarget()

      // Look up storage_path from libraryImages and get full-res signed URLs
      const resolved = await Promise.all(
        selected.map(async (item) => {
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
      const results = layoutMasonry(items, 6, c.x, c.y, 300)

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
    },
    [pushUndo, getPasteTarget, libraryImages],
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
      const pad = 60
      const s = Math.min(
        Math.max(
          Math.min(
            (r.width - pad * 2) / bounds.w,
            (r.height - pad * 2) / bounds.h,
          ),
          MIN_SCALE,
        ),
        MAX_SCALE,
      )
      setTransform({
        x: r.width / 2 - (bounds.x + bounds.w / 2) * s,
        y: r.height / 2 - (bounds.y + bounds.h / 2) * s,
        scale: s,
      })
    },
    [],
  )

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
      const fill = 0.75
      const s = Math.min(
        Math.max(
          Math.min((r.width * fill) / b.w, (r.height * fill) / b.h),
          MIN_SCALE,
        ),
        MAX_SCALE,
      )
      setTransform({
        x: r.width / 2 - (b.x + b.w / 2) * s,
        y: r.height / 2 - (b.y + b.h / 2) * s,
        scale: s,
      })
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
      pushUndo()
      const sel = sRef.current
      setImages((prev) => prev.filter((img) => !sel.has(img.id)))
      // Clean up groups: remove deleted images, dissolve groups with <2 members
      setGroups((prev) =>
        prev
          .map((g) => ({
            ...g,
            imageIds: g.imageIds.filter((id) => !sel.has(id)),
          }))
          .filter((g) => g.imageIds.length >= 2),
      )
      setSelected(new Set())
      sRef.current = new Set()
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
              className={`${styles.image}${selected.size >= 2 && selectionBounds && !selected.has(img.id) && img.x + img.width >= selectionBounds.x && img.x <= selectionBounds.x + selectionBounds.w && img.y + img.height >= selectionBounds.y && img.y <= selectionBounds.y + selectionBounds.h ? ` ${styles.dimmed}` : ''}${img.pending ? ` ${styles.pending}` : ''}`}
              style={{
                left: img.x,
                top: img.y,
                width: img.width,
                height: img.height,
              }}
            >
              {img.pending ? (
                <div className={styles.pendingInner} />
              ) : (
                <img src={img.signedUrl} alt="" draggable={false} />
              )}
            </div>
          ))}
        </div>

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
          onGenerate={
            selected.size === 1
              ? () => {
                  const id = [...selected][0]
                  const sourceImage = images.find((img) => img.id === id)
                  if (sourceImage) canvasGen.open(sourceImage)
                }
              : undefined
          }
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
              if (sourceImage) canvasGen.open(sourceImage)
              setContextMenu(null)
            }}
          >
            Generate
          </button>
        </div>
      )}

      <CanvasGenerateDialog canvasGen={canvasGen} />

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
