import { useCallback, useMemo, useRef, useState } from 'react'
import { getSignedUrl, setOnCanvas } from '../lib/persistence'
import { canvasModelIdsForRefCount } from '../canvas-models'
import type { CanvasImage } from '../types'
import { useGenerator } from '@/features/ai-images/hooks/use-generator'
import { useModelSelector } from '@/components/ModelSelector'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { useUserImages } from '@/features/user-images'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { checkPendingGenerations } from '@/lib/server/check-pending-generations.server'
import { detectAspectRatio } from '@/features/ai-images/constants'

/** Parse "w:h" string into numeric ratio */
function parseRatio(r: string): number {
  const [w, h] = r.split(':').map(Number)
  return w && h ? w / h : 1
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  )
}

/** Bounding box of a set of canvas images. */
function boundsOf(imgs: Array<CanvasImage>): Rect {
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

export function useCanvasGenerate(
  setImages: React.Dispatch<React.SetStateAction<Array<CanvasImage>>>,
  pushUndo: () => void,
  getImages: () => Array<CanvasImage>,
  revealBounds: (b: Rect) => void,
) {
  const { session, user } = useAuth()
  const accessToken = session?.access_token
  const credits = useCredits()
  const userImages = useUserImages(user?.id)

  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  // Number of reference images in the current selection (selection size - 1, the
  // primary). Scopes the model list to models that can hold them.
  const [groupRefCount, setGroupRefCount] = useState(0)
  // Auto image labels prepended to the prompt at submit ("[Image 1, Image 2,...]").
  const [labelPrefix, setLabelPrefix] = useState('')

  const sourceRef = useRef<CanvasImage | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingPlaceholdersRef = useRef<Array<string>>([])
  // Shared tracking for the single poll loop. Multiple batches (a fresh submit
  // plus a mount-time resume, or two back-to-back generations) accumulate into
  // these refs rather than each replacing the interval, so no batch loses its
  // tracking when another starts.
  const recordToPlaceholderRef = useRef<Map<string, string>>(new Map())
  const pendingRecordIdsRef = useRef<Set<string>>(new Set())
  // Geometry of the current placeholder row, so handleAfterSubmit can append
  // extra placeholders if the server returns more results than we predicted.
  const placeholderLayoutRef = useRef<{
    startX: number
    y: number
    placeholderW: number
    placeholderH: number
    gap: number
  } | null>(null)

  // Only models whose edit endpoint can hold the current reference count are
  // offered; a single image (groupRefCount 0) exposes every curated model.
  const allowedIds = useMemo(
    () => canvasModelIdsForRefCount(groupRefCount),
    [groupRefCount],
  )

  const modelSelector = useModelSelector({
    capability: 'generate',
    mode: 'multi',
    allowedIds,
    storageScope: 'canvas',
  })

  // Poll user_images until every tracked record resolves, swapping each
  // placeholder for the finished image (or removing it on failure). Shared by
  // fresh submissions and by mount-time recovery of persisted placeholders.
  // New batches merge into the shared refs and a single interval drains them all,
  // so starting one batch never abandons another that's still in flight.
  const startPolling = useCallback(
    (recordToPlaceholder: Map<string, string>) => {
      for (const [recordId, placeholderId] of recordToPlaceholder) {
        recordToPlaceholderRef.current.set(recordId, placeholderId)
        pendingRecordIdsRef.current.add(recordId)
      }
      if (pendingRecordIdsRef.current.size === 0) {
        setIsGenerating(false)
        return
      }

      setIsGenerating(true)

      const poll = async () => {
        const pending = pendingRecordIdsRef.current
        const map = recordToPlaceholderRef.current
        if (pending.size === 0) {
          if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
          }
          setIsGenerating(false)
          return
        }

        await checkPendingGenerations({
          data: { accessToken: accessToken! },
        }).catch(() => {})

        for (const recordId of [...pending]) {
          const { data: record } = await supabase
            .from('user_images')
            .select('id, status, storage_path')
            .eq('id', recordId)
            .single()

          if (!record) continue

          if (record.status === 'completed' && record.storage_path) {
            pending.delete(recordId)
            const placeholderId = map.get(recordId)
            map.delete(recordId)
            if (!placeholderId) continue

            const storagePath = record.storage_path
            const signedUrl = await getSignedUrl(storagePath)

            if (signedUrl) {
              setImages((prev) =>
                prev.map((ci) =>
                  ci.id === placeholderId
                    ? {
                        ...ci,
                        recordId,
                        storagePath,
                        signedUrl,
                        pending: false,
                      }
                    : ci,
                ),
              )
            } else {
              setImages((prev) => prev.filter((ci) => ci.id !== placeholderId))
            }
          } else if (record.status === 'failed') {
            pending.delete(recordId)
            const placeholderId = map.get(recordId)
            map.delete(recordId)
            if (placeholderId) {
              setImages((prev) => prev.filter((ci) => ci.id !== placeholderId))
            }
          }
        }

        if (pending.size === 0) {
          if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
          }
          setIsGenerating(false)
        }
      }

      // Ensure exactly one interval is running; merged records are picked up by
      // the existing loop (within one tick) without restarting it.
      if (!pollRef.current) {
        pollRef.current = setInterval(poll, 5000)
        setTimeout(poll, 3000)
      }
    },
    [accessToken, setImages],
  )

  // When server returns record IDs, map them to placeholders and poll for completion
  const handleAfterSubmit = useCallback(
    (results: Array<{ recordId: string }>) => {
      let placeholderIds = pendingPlaceholdersRef.current
      if (placeholderIds.length === 0) return

      // Reconcile placeholder count to the actual number of results so no
      // generated image is ever dropped (and none is left as an empty slot).
      if (results.length < placeholderIds.length) {
        const extraIds = placeholderIds.slice(results.length)
        setImages((prev) => prev.filter((ci) => !extraIds.includes(ci.id)))
        placeholderIds = placeholderIds.slice(0, results.length)
      } else if (results.length > placeholderIds.length) {
        const layout = placeholderLayoutRef.current
        const added: Array<string> = []
        const extra: Array<CanvasImage> = []
        for (let i = placeholderIds.length; i < results.length; i++) {
          const id = crypto.randomUUID()
          added.push(id)
          extra.push({
            id,
            recordId: '',
            storagePath: '',
            x: layout
              ? layout.startX + i * (layout.placeholderW + layout.gap)
              : 0,
            y: layout ? layout.y : 0,
            width: layout ? layout.placeholderW : 300,
            height: layout ? layout.placeholderH : 300,
            pending: true,
          })
        }
        setImages((prev) => [...prev, ...extra])
        placeholderIds = [...placeholderIds, ...added]
      }
      pendingPlaceholdersRef.current = placeholderIds

      const recordToPlaceholder = new Map<string, string>()
      results.forEach((r, i) => {
        if (i < placeholderIds.length) {
          recordToPlaceholder.set(r.recordId, placeholderIds[i])
        }
      })

      // Stamp the recordId onto each placeholder immediately so it persists to
      // IndexedDB and can be recovered if the user navigates away before the
      // generation completes.
      setImages((prev) =>
        prev.map((ci) => {
          const idx = placeholderIds.indexOf(ci.id)
          if (idx >= 0 && idx < results.length) {
            return { ...ci, recordId: results[idx].recordId }
          }
          return ci
        }),
      )

      // Eagerly mark these rows on-canvas so they're reclaimable from the DB even
      // if the user navigates/restarts before any local save.
      void setOnCanvas(
        results.map((r) => r.recordId),
        true,
      )

      startPolling(recordToPlaceholder)
    },
    [setImages, startPolling],
  )

  // Resume polling for persisted pending placeholders after navigation/refresh.
  // Called on canvas mount with images that have a recordId but no storagePath.
  const resumePending = useCallback(
    (pending: Array<{ id: string; recordId: string }>) => {
      if (pending.length === 0) return
      const recordToPlaceholder = new Map<string, string>()
      for (const p of pending) recordToPlaceholder.set(p.recordId, p.id)
      startPolling(recordToPlaceholder)
    },
    [startPolling],
  )

  const generator = useGenerator({
    accessToken,
    selectedModels: modelSelector.selectedIds,
    gensPerModel: modelSelector.gensPerModel,
    credits,
    setError,
    storagePrefix: 'genzen-canvas',
    onAfterSubmit: handleAfterSubmit,
    onCanvas: true,
    sourceClient: 'genzen-canvas',
    promptPrefix: labelPrefix,
  })

  // Optimistic generation: create placeholders, then fire server call.
  // Placeholders go to the right of the source; if that would overlap existing
  // images, the block is relocated to clear space below everything so previews
  // never land on top of other images. For a single image the source moves with
  // its previews (keeping them together); for a group the inputs stay put.
  const handleGenerateOptimistic = useCallback(() => {
    const source = sourceRef.current
    if (!source || !generator.canGenerate) return

    const ratio = parseRatio(generator.aspectRatio)
    const placeholderH = source.height
    const placeholderW = Math.round(placeholderH * ratio)
    // generator.totalImages already accounts for prompts x models x gensPerModel.
    const totalCount = generator.totalImages
    const gap = 40

    const isSingle = generator.refImages.length === 0
    // Images the previews must not overlap. For single, exclude the source (it
    // may move with the block); for a group the inputs stay where they are.
    const obstacles = getImages().filter(
      (img) => !img.pending && (isSingle ? img.id !== source.id : true),
    )

    let originX = source.x
    let originY = source.y
    let startX = source.x + source.width + gap

    const childRow = (sx: number, y: number): Array<Rect> =>
      Array.from({ length: totalCount }, (_, i) => ({
        x: sx + i * (placeholderW + gap),
        y,
        w: placeholderW,
        h: placeholderH,
      }))

    const hits = (rects: Array<Rect>) =>
      rects.some((r) =>
        obstacles.some((o) =>
          rectsOverlap(r, { x: o.x, y: o.y, w: o.width, h: o.height }),
        ),
      )

    if (hits(childRow(startX, originY))) {
      const bounds = boundsOf(obstacles.length ? obstacles : [source])
      originY = bounds.y + bounds.h + gap * 2
      if (isSingle) {
        originX = bounds.x
        startX = originX + source.width + gap
      } else {
        startX = bounds.x
      }
    }

    placeholderLayoutRef.current = {
      startX,
      y: originY,
      placeholderW,
      placeholderH,
      gap,
    }

    pushUndo()

    // If the single-image block moved, carry the source image with it.
    if (isSingle && (originX !== source.x || originY !== source.y)) {
      setImages((prev) =>
        prev.map((ci) =>
          ci.id === source.id ? { ...ci, x: originX, y: originY } : ci,
        ),
      )
    }

    const placeholderIds: Array<string> = []
    const placeholders: Array<CanvasImage> = []
    for (let i = 0; i < totalCount; i++) {
      const id = crypto.randomUUID()
      placeholderIds.push(id)
      placeholders.push({
        id,
        recordId: '',
        storagePath: '',
        x: startX + i * (placeholderW + gap),
        y: originY,
        width: placeholderW,
        height: placeholderH,
        pending: true,
      })
    }
    pendingPlaceholdersRef.current = placeholderIds

    setImages((prev) => [...prev, ...placeholders])
    setIsGenerating(true)
    setIsOpen(false)

    // Reveal the previews (plus the source, for a single) so it's clear they
    // appeared even if the block moved off-screen.
    const revealX = isSingle ? Math.min(originX, startX) : startX
    const rowEnd = startX + totalCount * (placeholderW + gap) - gap
    revealBounds({
      x: revealX,
      y: originY,
      w: rowEnd - revealX,
      h: Math.max(isSingle ? source.height : 0, placeholderH),
    })

    generator.handleGenerate().catch(() => {
      setImages((prev) => prev.filter((ci) => !placeholderIds.includes(ci.id)))
      setIsGenerating(false)
    })
  }, [generator, setImages, pushUndo, getImages, revealBounds])

  // Open the Generate dialog for a selection. The first image is the primary
  // (Image 1, the source, shown up top); the rest pre-fill the reference strip
  // (Image 2..N). Models are scoped to those that can hold the references, and
  // every image is auto-labeled so the user can reference it by number.
  const open = useCallback(
    async (selection: Array<CanvasImage>) => {
      if (selection.length === 0) return
      const source = selection[0]
      const extras = selection.slice(1)
      sourceRef.current = source
      setError(null)

      setGroupRefCount(extras.length)
      setLabelPrefix(
        selection.length > 1
          ? `[${selection.map((_, i) => `Image ${i + 1}`).join(', ')}]\n\n`
          : '',
      )

      // Primary image (Image 1) -> source slot. Signed URL is CORS-safe.
      const url = source.signedUrl ?? (await getSignedUrl(source.storagePath))
      if (url) generator.setSourceFromUrl(url, 'canvas-image')

      // Remaining images (Image 2..N) -> reference strip, by recordId so they
      // flow through as referenceImageIds (metadata parity). replaceRefImages
      // skips the per-model slice; the scoped model list guarantees they fit.
      if (extras.length > 0) {
        const refs = await Promise.all(
          extras.map(async (img) => ({
            id: img.recordId,
            url: img.signedUrl ?? (await getSignedUrl(img.storagePath)) ?? '',
            title: 'reference',
          })),
        )
        generator.replaceRefImages(refs.filter((r) => r.id && r.url))
      } else {
        generator.replaceRefImages([])
      }

      // Orientation + aspect ratio from the primary image.
      const detected = detectAspectRatio(source.width, source.height)
      generator.setOrientation(
        source.width >= source.height ? 'landscape' : 'portrait',
      )
      generator.setAspectRatio(detected)

      // Pre-fill prompt from the primary's metadata (single-image only).
      if (selection.length === 1 && source.recordId) {
        const { data: record } = await supabase
          .from('user_images')
          .select('generation_metadata')
          .eq('id', source.recordId)
          .single()

        const metadata = record?.generation_metadata as Record<
          string,
          unknown
        > | null
        const prompt = metadata?.prompt as string | undefined
        if (prompt) generator.setPrompt(prompt)
      }

      setIsOpen(true)
    },
    [generator],
  )

  const close = useCallback(() => {
    setIsOpen(false)
    sourceRef.current = null
  }, [])

  return {
    isOpen,
    open,
    close,
    generator,
    modelSelector,
    credits,
    userImages,
    error,
    isGenerating,
    handleGenerateOptimistic,
    resumePending,
  }
}
