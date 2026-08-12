'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  getCanvasGenerationRecord,
  getImagePrompt,
} from '../../_actions/canvas'
import { canvasModelIdsForRefCount } from '../../_lib/canvas-models'
import { mapOutcomesToPlaceholders } from '../../_lib/generation-mapping'
import type { CanvasImage } from '../../_lib/types'
import { imageUrl } from '#/lib/image-url'
import { useGenerator } from '#/features/ai-images/hooks/use-generator'
import { useModelSelector } from '#/features/ai-images/model-selector/use-model-selector'
import { useUserImages } from '#/features/user-images'
import { useAuth } from '#/lib/auth'
import { checkPendingGenerations } from '#/lib/server/check-pending-generations.action'
import { detectAspectRatio } from '#/features/ai-images/constants'
import { retryGeneration } from '#/features/ai-images/server/retry-generation.action'
import { normalizeGeneration } from '#/features/ai-images/normalize-generation'

/** A failed tile can be retried once it has a DB record to resubmit. */
export function canRetryFailure(img: CanvasImage): boolean {
  return !!img.recordId
}

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
  groupImages: (imageIds: Array<string>, columns: number) => void,
) {
  const { user } = useAuth()
  const userImages = useUserImages(user.id)

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

        await checkPendingGenerations().catch(() => {})

        for (const recordId of [...pending]) {
          const record = await getCanvasGenerationRecord(recordId).catch(
            () => null,
          )

          if (!record) continue

          const recordModel = (
            record.generation_metadata as { model?: string } | null
          )?.model
          const storagePath = record.storage_path
          const signedUrl = storagePath ? imageUrl(recordId) : null
          const view = normalizeGeneration(record, signedUrl ?? undefined)

          if (view.status === 'completed' || view.status === 'failed') {
            pending.delete(recordId)
            const placeholderId = map.get(recordId)
            map.delete(recordId)
            if (!placeholderId) continue

            if (view.status === 'completed' && signedUrl && storagePath) {
              setImages((prev) =>
                prev.map((ci) =>
                  ci.id === placeholderId
                    ? {
                        ...ci,
                        recordId,
                        storagePath,
                        signedUrl,
                        pending: false,
                        ...(recordModel ? { model: recordModel } : {}),
                      }
                    : ci,
                ),
              )
            } else {
              // failed, or completed-but-no-signedUrl: persist as failed tile
              // instead of silently dropping it (invariant #3).
              const errorMessage =
                view.status === 'failed'
                  ? (view.errorMessage ?? 'Generation failed')
                  : 'Image could not be loaded'
              setImages((prev) =>
                prev.map((ci) =>
                  ci.id === placeholderId
                    ? {
                        ...ci,
                        pending: false,
                        failed: true,
                        errorMessage,
                        ...(recordModel ? { model: recordModel } : {}),
                      }
                    : ci,
                ),
              )
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
    [setImages],
  )

  // Map each ordered submit outcome (outcomes[i] ↔ placeholderIds[i]) to its
  // placeholder: stamp recordId + model on successes (then poll), mark failures
  // failed in place (model + error) so nothing silently vanishes.
  const handleAfterSubmit = useCallback(
    (
      outcomes: Array<{
        model: string
        recordId: string | null
        error: string | null
      }>,
    ) => {
      let placeholderIds = pendingPlaceholdersRef.current
      if (placeholderIds.length === 0) return

      // Defensive: if the server somehow returned more outcomes than predicted,
      // append placeholders so none is dropped. (Counts normally match exactly.)
      if (outcomes.length > placeholderIds.length) {
        const layout = placeholderLayoutRef.current
        const added: Array<string> = []
        const extra: Array<CanvasImage> = []
        for (let i = placeholderIds.length; i < outcomes.length; i++) {
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

      const { recordToPlaceholder, updates } = mapOutcomesToPlaceholders(
        outcomes,
        placeholderIds,
      )
      const updateById = new Map(updates.map((u) => [u.placeholderId, u]))

      // Apply per-placeholder updates in one pass: successes get recordId+model;
      // failures (submit rejected, no DB record) become failed tiles with model +
      // error. A success needs no membership write here -- the generation insert
      // wrote its `canvas_images` row unplaced at reserve time (#212), which is
      // what makes it reclaimable if the tab goes away before FAL answers.
      setImages((prev) =>
        prev.map((ci) => {
          const u = updateById.get(ci.id)
          if (!u) return ci
          if (u.recordId) {
            return { ...ci, recordId: u.recordId, model: u.model }
          }
          return {
            ...ci,
            pending: false,
            failed: true,
            errorMessage: u.errorMessage,
            model: u.model,
          }
        }),
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

  // Retry a failed FAL tile: resubmit via retryGeneration, repoint the tile to
  // the row it returns, and resume polling. Retry reuses the same row, so its
  // membership is already there and needs no write.
  const retryFailed = useCallback(
    async (canvasImageId: string) => {
      const img = getImages().find((ci) => ci.id === canvasImageId)
      if (!img || !canRetryFailure(img)) return
      const oldRecordId = img.recordId

      setImages((prev) =>
        prev.map((ci) =>
          ci.id === canvasImageId
            ? { ...ci, pending: true, failed: false, errorMessage: undefined }
            : ci,
        ),
      )

      try {
        const { recordId } = await retryGeneration({ recordId: oldRecordId })
        setImages((prev) =>
          prev.map((ci) =>
            ci.id === canvasImageId ? { ...ci, recordId } : ci,
          ),
        )
        const map = new Map<string, string>()
        map.set(recordId, canvasImageId)
        startPolling(map)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Retry failed'
        setImages((prev) =>
          prev.map((ci) =>
            ci.id === canvasImageId
              ? { ...ci, pending: false, failed: true, errorMessage: message }
              : ci,
          ),
        )
      }
    },
    [getImages, setImages, startPolling],
  )

  const generator = useGenerator({
    // The canvas authored the request: the selection became source +
    // references, the prompt was auto-labelled, and the model list was scoped
    // by reference capacity. That is why it is its own origin (#207).
    origin: 'canvas',
    selectedModels: modelSelector.selectedIds,
    gensPerModel: modelSelector.gensPerModel,
    setError,
    storagePrefix: 'genzen-canvas',
    onAfterSubmit: handleAfterSubmit,
    onCanvas: true,
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

    // One input image. Was `refImages.length === 0`, when the first image lived
    // in a separate source slot and the strip held only the extras; the set
    // holds all of them now, so one input reads as length 1 (#297).
    const isSingle = generator.refImages.length <= 1
    // Models expanded by gensPerModel — placeholder[i] maps to
    // modelsExpanded[i % len] matching the submit order from useGenerator.
    const modelsExpanded = modelSelector.selectedIds.flatMap((id) =>
      Array.from({ length: modelSelector.gensPerModel }, () => id),
    )
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
        model: modelsExpanded[i % modelsExpanded.length],
      })
    }
    pendingPlaceholdersRef.current = placeholderIds

    setImages((prev) => [...prev, ...placeholders])
    // Single-image generate: auto-group the origin with its generations so they
    // stay together as a unit. (Group generate leaves the scattered inputs.)
    if (isSingle) {
      groupImages([source.id, ...placeholderIds], totalCount + 1)
    }
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

    generator.handleGenerate().catch((err: unknown) => {
      // handleGenerate normally surfaces partial failures via onAfterSubmit (per
      // tile) and its own setError; this guards a hard rejection before any
      // outcome lands -- mark the still-pending placeholders failed rather than
      // delete them, so the failure stays visible.
      const message = err instanceof Error ? err.message : 'Generation failed'
      setError(message)
      setImages((prev) =>
        prev.map((ci) =>
          placeholderIds.includes(ci.id) && ci.pending && !ci.recordId
            ? { ...ci, pending: false, failed: true, errorMessage: message }
            : ci,
        ),
      )
      setIsGenerating(false)
    })
  }, [
    generator,
    modelSelector,
    setImages,
    pushUndo,
    getImages,
    revealBounds,
    groupImages,
  ])

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

      // The whole selection becomes the set, in order (#297). Canvas already
      // believed this -- it labels the selection `[Image 1, Image 2, ...]` and
      // treated the first as primary only because the panel had a slot to put
      // it in. There is no slot now, so `open` no longer has to split it.
      //
      // Everything goes in by recordId: without one an image is bytes with no
      // identity and Retry cannot send it again (#214). The URL is the panel's
      // preview only -- the submit sends ids. `replaceRefImages` skips the
      // per-model slice, which the scoped model list has already guaranteed.
      generator.replaceRefImages(
        selection
          .map((img) => ({
            id: img.recordId,
            url: img.signedUrl ?? imageUrl(img.recordId),
            title: 'canvas-image',
          }))
          .filter((r) => r.id && r.url),
      )

      // Orientation + aspect ratio from the primary image.
      const detected = detectAspectRatio(source.width, source.height)
      generator.setOrientation(
        source.width >= source.height ? 'landscape' : 'portrait',
      )
      generator.setAspectRatio(detected)

      // Pre-fill prompt from the primary's metadata (single-image only).
      if (selection.length === 1 && source.recordId) {
        const prompt = await getImagePrompt(source.recordId).catch(() => null)
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
    userImages,
    error,
    isGenerating,
    handleGenerateOptimistic,
    resumePending,
    retryFailed,
  }
}
