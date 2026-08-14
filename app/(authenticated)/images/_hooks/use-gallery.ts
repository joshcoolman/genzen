'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SavedAiImage } from '#/features/ai-images/types'
import { toast } from '#/components'
import { retryGeneration } from '#/features/ai-images/server/retry-generation.action'
import { updateImageOrder } from '#/features/ai-images/server/update-image-order.action'
import { GALLERY_SEED_LIMIT } from '#/features/ai-images/gallery-seed'
import { useGenerationPoll } from '#/features/ai-images/hooks/use-generation-poll'
import { imageUrl } from '#/lib/image-url'
import { isOptimisticId } from '#/lib/optimistic-id'
import {
  deleteGalleryImage,
  listGalleryImages,
  trashGalleryImages,
} from '#/features/ai-images/server/gallery.action'

interface UseImagesOptions {
  userId: string | undefined
  /** The server component's read. A seed, not the source of truth -- every
   *  read after the first is this hook's. */
  initial: Array<SavedAiImage>
}

interface RefreshOptions {
  /** Leave the existing cards on screen instead of showing the skeleton. */
  silent?: boolean
}

function sortByOrder(images: Array<SavedAiImage>): Array<SavedAiImage> {
  return [...images].sort((a, b) => {
    const aOrder = a.sort_order ?? new Date(a.created_at).getTime() / 1000
    const bOrder = b.sort_order ?? new Date(b.created_at).getTime() / 1000
    return bOrder - aOrder
  })
}

export interface GalleryState {
  images: Array<SavedAiImage>
  imageUrls: Record<string, string>
  loadingGallery: boolean
  deleteImage: (img: SavedAiImage) => Promise<void>
  /** The selection drawer's Trash: one round trip for the whole set (#329). */
  deleteImages: (images: Array<SavedAiImage>) => Promise<void>
  /**
   * The React key for a row, which is **not** its id (#353).
   *
   * A generation's card is born with an optimistic id and swaps it for its
   * record id the moment the submit answers. The id was the key, so React saw
   * one card removed and a different one added, and threw away a mounted tile
   * to build an identical one -- four times in a three-image burst, at the
   * busiest moment in the app. The comment on that swap claimed it was
   * invisible; it was a remount.
   *
   * So the card keeps the identity it was born with, and the id is free to
   * change underneath it. A row that never had an optimistic card -- anything
   * that arrived from the server -- is its own key.
   */
  keyFor: (id: string) => string
  /** Patch rows already on screen -- a group write's half of the grid (#331).
   *  Membership is a column on the image, so filing pictures into a group is
   *  a field change on rows this hook already holds, not a re-read. */
  patchImages: (ids: Array<string>, patch: Partial<SavedAiImage>) => void
  /** Drop rows the server has already removed. The caller did the write --
   *  unlike `deleteImages`, which is the write. */
  forgetImages: (ids: Array<string>) => void
  addOptimisticCard: (card: SavedAiImage) => void
  /** An updater rather than a replacement: a generation's card already holds
   *  the prompt and model the submit only echoes back, so the swap is the id
   *  and nothing else. */
  replaceOptimisticCard: (
    optimisticId: string,
    next: (card: SavedAiImage) => SavedAiImage,
  ) => void
  removeOptimisticCard: (optimisticId: string) => void
  setImageUrl: (id: string, url: string) => void
  reorderImages: (draggedId: string, newSortOrder: number) => Promise<void>
  retryImage: (img: SavedAiImage) => Promise<void>
  refresh: (options?: RefreshOptions) => Promise<void>
}

/** A URL names the row, so the seed's map needs no request and no storage
 *  client. `?v=thumb` falls back to the original server-side when a thumbnail
 *  was never generated, so the caller does not choose. */
function urlsFor(images: Array<SavedAiImage>): Record<string, string> {
  const urls: Record<string, string> = {}
  for (const img of images) {
    if (img.status !== 'completed') continue
    if (img.storage_path) urls[img.id] = imageUrl(img.id, 'thumb')
  }
  return urls
}

export function useGallery({
  userId,
  initial,
}: UseImagesOptions): GalleryState {
  const [savedImages, setSavedImages] = useState<Array<SavedAiImage>>(() =>
    sortByOrder(initial),
  )
  const [imageUrls, setImageUrls] = useState<Record<string, string>>(() =>
    urlsFor(initial),
  )
  // The server component already ran the read, so there is nothing to wait for
  // on first paint. A non-silent refresh can still turn this on.
  const [loadingGallery, setLoadingGallery] = useState(false)

  // record id -> the optimistic id its card was born with. Survives the list
  // replacement a refresh does, which is the point: the server's row for a
  // generation must key the same as the card already on screen for it.
  const bornAs = useRef<Record<string, string>>({})

  const loadSavedImages = useCallback(
    async (options?: RefreshOptions) => {
      if (!userId) return

      try {
        if (!options?.silent) setLoadingGallery(true)

        const images = sortByOrder(await listGalleryImages())
        // A refresh replaces the whole list, so anything still in flight has to
        // be carried over -- it has no row yet to be replaced by. The 5s poll
        // calls this while generations are pending, which is exactly when
        // optimistic cards exist, so dropping them would blank the grid a
        // second after it filled (#313).
        setSavedImages((prev) => {
          const inFlight = prev.filter((i) => isOptimisticId(i.id))
          return inFlight.length > 0
            ? sortByOrder([...inFlight, ...images])
            : images
        })
        setLoadingGallery(false)

        // Same reason, for the blob preview a pasted upload is showing.
        setImageUrls((prev) => {
          const next = urlsFor(images)
          for (const [id, url] of Object.entries(prev)) {
            if (isOptimisticId(id)) next[id] = url
          }
          return next
        })
      } catch {
        console.error('Failed to load saved AI images')
      } finally {
        setLoadingGallery(false)
      }
    },
    [userId],
  )

  // The seed is bounded (#328), so a library bigger than one page arrives
  // first-page-only and is completed here. `initial` is still the read on
  // arrival -- there is no mount fetch for a library that fits, which is the
  // common case and the one worth keeping free.
  const backfilled = useRef(false)
  useEffect(() => {
    if (backfilled.current) return
    if (initial.length < GALLERY_SEED_LIMIT) return
    backfilled.current = true
    void loadSavedImages({ silent: true })
  }, [initial.length, loadSavedImages])

  // Poll FAL for pending generations (skipped when webhooks are enabled).
  //
  // The poll is also how the gallery finds out anything changed. There used to
  // be a `postgres_changes` channel here doing that, but it went with #174:
  // `user_images` is in no publication, and the browser has had no Supabase
  // session since #171, so it had already stopped delivering anything.
  //
  // The timer itself is `useGenerationPoll` -- backoff, tab-visibility and
  // giving up live there, shared with Video and Activity (#327).
  const oldestPending =
    process.env.NEXT_PUBLIC_ENABLE_FAL_WEBHOOKS === 'true'
      ? null
      : (savedImages
          .filter((img) => img.status === 'pending' && !isOptimisticId(img.id))
          .reduce<
            string | null
          >((oldest, img) => (!oldest || img.created_at < oldest ? img.created_at : oldest), null) ??
        null)

  useGenerationPoll(oldestPending, () => loadSavedImages({ silent: true }))

  function addOptimisticCard(card: SavedAiImage) {
    setSavedImages((prev) => [card, ...prev])
  }

  function replaceOptimisticCard(
    optimisticId: string,
    next: (card: SavedAiImage) => SavedAiImage,
  ) {
    setSavedImages((prev) =>
      prev.map((i) => {
        if (i.id !== optimisticId) return i
        const swapped = next(i)
        // Remember what this row's card was called before the swap, so it
        // keeps its React key and its DOM node (#353).
        if (swapped.id !== optimisticId)
          bornAs.current[swapped.id] = optimisticId
        return swapped
      }),
    )
  }

  function removeOptimisticCard(optimisticId: string) {
    setSavedImages((prev) => prev.filter((i) => i.id !== optimisticId))
  }

  const keyFor = useCallback((id: string) => bornAs.current[id] ?? id, [])

  function setImageUrl(id: string, url: string) {
    setImageUrls((prev) => ({ ...prev, [id]: url }))
  }

  function forgetImages(ids: Set<string>) {
    for (const id of ids) delete bornAs.current[id]
    setSavedImages((prev) => prev.filter((i) => !ids.has(i.id)))
    setImageUrls((prev) => {
      const next = { ...prev }
      for (const id of ids) delete next[id]
      return next
    })
  }

  function patchImages(ids: Array<string>, patch: Partial<SavedAiImage>) {
    const set = new Set(ids)
    setSavedImages((prev) =>
      prev.map((i) => (set.has(i.id) ? { ...i, ...patch } : i)),
    )
  }

  async function deleteImage(img: SavedAiImage) {
    forgetImages(new Set([img.id]))

    // A card whose row does not exist yet is dismissed locally and nothing
    // else. Sending an optimistic id to the server is a guaranteed error, and
    // the catch below would answer it with a refresh that re-adds the row the
    // moment the submit lands.
    if (isOptimisticId(img.id)) return

    try {
      await deleteGalleryImage(img.id)
    } catch {
      await loadSavedImages({ silent: true })
    }
  }

  /**
   * Trash a set of images: the cards leave now, the server hears once (#329).
   *
   * The grid used to sit still until the last of N round trips landed. It moves
   * on the click instead, and a failure re-reads -- which puts back whatever is
   * genuinely still there, rather than this hook trying to remember what it
   * removed.
   */
  async function deleteImages(images: Array<SavedAiImage>) {
    const ids = images.map((i) => i.id)
    forgetImages(new Set(ids))

    const real = ids.filter((id) => !isOptimisticId(id))
    if (real.length === 0) return

    try {
      await trashGalleryImages(real)
    } catch {
      toast('Could not move those to Trash')
      await loadSavedImages({ silent: true })
    }
  }

  async function retryImage(img: SavedAiImage) {
    // The retry reuses this row, so the card stays where it is and goes back to
    // pending in place. Flipping it here also restarts the poll, which is what
    // carries it to its next outcome.
    setSavedImages((prev) =>
      prev.map((i) =>
        i.id === img.id
          ? { ...i, status: 'pending' as const, generation_error: null }
          : i,
      ),
    )
    try {
      await retryGeneration({ recordId: img.id })
    } catch (err) {
      // Put the failed state back -- the retry never reached FAL.
      setSavedImages((prev) => prev.map((i) => (i.id === img.id ? img : i)))
      // And say why. A retry can refuse for a reason the user can act on --
      // a source that was pasted rather than saved cannot be sent again -- and
      // swallowing it left the card looking like it had simply failed twice
      // with the original error (#214).
      toast.error(err instanceof Error ? err.message : 'Retry failed')
    }
  }

  async function reorderImages(draggedId: string, newSortOrder: number) {
    const prev = savedImages
    setSavedImages((current) =>
      sortByOrder(
        current.map((img) =>
          img.id === draggedId ? { ...img, sort_order: newSortOrder } : img,
        ),
      ),
    )

    try {
      await updateImageOrder({ imageId: draggedId, sortOrder: newSortOrder })
    } catch {
      setSavedImages(prev)
    }
  }

  return {
    images: savedImages,
    imageUrls,
    loadingGallery,
    keyFor,
    deleteImage,
    deleteImages,
    patchImages,
    forgetImages: (ids: Array<string>) => forgetImages(new Set(ids)),
    addOptimisticCard,
    replaceOptimisticCard,
    removeOptimisticCard,
    setImageUrl,
    reorderImages,
    retryImage,
    refresh: loadSavedImages,
  }
}
