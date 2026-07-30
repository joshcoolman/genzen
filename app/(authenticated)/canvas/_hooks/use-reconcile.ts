'use client'

import { useEffect, useRef } from 'react'
import { layoutMasonry } from '../_lib/masonry'
import { getUrlDimensions } from '../_lib/persistence'
import type { CanvasState } from '../_lib/persistence'
import type { CanvasImage } from '../_lib/types'

/** How far right of the existing arrangement reclaimed cards start. */
const RECLAIM_GAP = 400
const FALLBACK_HEIGHT = 300

interface Seed {
  images: Array<CanvasImage>
  unplacedIds: Set<string>
}

interface UseReconcileArgs {
  initial: CanvasState
  seed: Seed
  setImages: React.Dispatch<React.SetStateAction<Array<CanvasImage>>>
  resumePending: (rows: Array<{ id: string; recordId: string }>) => void
}

/** Place what is unplaced -- the only reconcile rule left (#212).
 *
 *  A membership row can arrive without a position, because a generation's row is
 *  written the moment it is reserved, server-side, before any client has decided
 *  where the card goes. This lays those out beside whatever is already placed.
 *
 *  Nothing else needs reconciling, and that is structural rather than tidy:
 *  reclaim is meaningless (the rows *are* the membership), prune is impossible
 *  (`on delete cascade`), dedupe is impossible (`unique (canvas_id, image_id)`).
 *
 *  Runs exactly once per mount -- it is a mount-time reconcile, not a sync. */
export function useReconcile({
  initial,
  seed,
  setImages,
  resumePending,
}: UseReconcileArgs) {
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
      if (pending.length > 0) resumePending(pending)
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
        originX =
          Math.max(...placedImages.map((i) => i.x + i.width)) + RECLAIM_GAP
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
          return {
            id: row.image_id,
            width: Math.round(FALLBACK_HEIGHT * (w && h ? w / h : 1)),
            height: FALLBACK_HEIGHT,
          }
        }),
      )

      const placed = new Map(
        layoutMasonry(sized, 6, originX, originY, FALLBACK_HEIGHT).map((p) => [
          p.id,
          p,
        ]),
      )

      setImages((prev) =>
        prev.map((img) => {
          const p = placed.get(img.id)
          return p
            ? { ...img, x: p.x, y: p.y, width: p.width, height: p.height }
            : img
        }),
      )

      if (pending.length > 0) resumePending(pending)
    })()
  }, [initial.images, seed, setImages, resumePending])
}
