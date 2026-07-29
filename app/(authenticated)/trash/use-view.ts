'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listTrashedImages,
  permanentlyDeleteImages,
  restoreImages,
} from './_actions/trash'
import type { TrashPayload } from './_actions/trash'
import type { UserImage } from '#/features/user-images/types'
import { createImageStorage } from '#/lib/image-storage'
import { useSelection } from '#/lib/use-selection'

/**
 * Trash list state.
 *
 * The first read is the server component's -- `page.tsx` runs
 * `listTrashedImages()` and hands the result in as `initial`, so there is no
 * loading state and no empty first paint. This hook owns every read after
 * that: each mutation is optimistic and then refetches, which is why the
 * server payload is a seed rather than the source of truth.
 *
 * No realtime (#174). Trash only changes from an action on this page or a
 * delete elsewhere, and either way the next visit re-reads it.
 *
 * `linkedImageIds` drives the disabled state on the delete controls but is not
 * what enforces the rule. The server recomputes the linked set inside
 * `permanentlyDeleteImages` and returns the ids it actually destroyed.
 */
export function useView(initial: TrashPayload) {
  const [images, setImages] = useState<Array<UserImage>>(initial.images)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [linkedImageIds, setLinkedImageIds] = useState<Set<string>>(
    () => new Set(initial.links.ids),
  )
  const [canvasLinkedIds, setCanvasLinkedIds] = useState<Set<string>>(
    () => new Set(initial.links.canvasIds),
  )
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isEmptying, setIsEmptying] = useState(false)
  const [isBatchRunning, setIsBatchRunning] = useState(false)

  const selection = useSelection({ items: images.map((img) => img.id) })

  /** Public URLs arrive one at a time so the first row is not held up by the
   *  last. Nothing on the page depends on the map being complete. */
  const signInBackground = useCallback((rows: Array<UserImage>) => {
    const storage = createImageStorage()
    for (const image of rows) {
      if (!image.storage_path) continue
      storage
        .getUrl(image.storage_path)
        .then((url) => {
          if (url) setImageUrls((prev) => ({ ...prev, [image.id]: url }))
        })
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    signInBackground(initial.images)
  }, [initial.images, signInBackground])

  const refetch = useCallback(async () => {
    try {
      const { images: rows, links } = await listTrashedImages()
      setImages(rows)
      setLinkedImageIds(new Set(links.ids))
      setCanvasLinkedIds(new Set(links.canvasIds))
      signInBackground(rows)
    } catch {
      console.error('Failed to load trashed images')
    }
  }, [signInBackground])

  const forget = useCallback((ids: Set<string>) => {
    setImages((prev) => prev.filter((img) => !ids.has(img.id)))
    setImageUrls((prev) => {
      const next = { ...prev }
      for (const id of ids) delete next[id]
      return next
    })
  }, [])

  const restoreMany = useCallback(
    async (ids: Array<string>) => {
      forget(new Set(ids))
      try {
        await restoreImages(ids)
      } catch (err) {
        await refetch()
        throw err
      }
    },
    [forget, refetch],
  )

  const permanentDeleteMany = useCallback(
    async (ids: Array<string>) => {
      const requested = ids.filter((id) => !linkedImageIds.has(id))
      if (requested.length === 0) return

      forget(new Set(requested))
      try {
        const deleted = await permanentlyDeleteImages(requested)
        // The server may have refused some of them -- a link can appear between
        // the page load and the click. Re-read rather than trust the optimism.
        if (deleted.length !== requested.length) await refetch()
      } catch (err) {
        await refetch()
        throw err
      }
    },
    [forget, linkedImageIds, refetch],
  )

  const restore = useCallback(
    async (id: string) => {
      setBusyId(id)
      try {
        await restoreMany([id])
      } finally {
        setBusyId(null)
      }
    },
    [restoreMany],
  )

  const permanentDelete = useCallback(
    async (id: string) => {
      setBusyId(id)
      try {
        await permanentDeleteMany([id])
      } finally {
        setBusyId(null)
      }
    },
    [permanentDeleteMany],
  )

  const runBatch = useCallback(
    async (fn: (ids: Array<string>) => Promise<void>) => {
      const ids = Array.from(selection.selectedIds)
      setIsBatchRunning(true)
      try {
        await fn(ids)
        selection.clearSelection()
      } finally {
        setIsBatchRunning(false)
      }
    },
    [selection],
  )

  const restoreSelected = useCallback(
    () => runBatch(restoreMany),
    [runBatch, restoreMany],
  )

  const deleteSelected = useCallback(
    () => runBatch(permanentDeleteMany),
    [runBatch, permanentDeleteMany],
  )

  const emptyTrash = useCallback(async () => {
    const deletable = images.filter((img) => !linkedImageIds.has(img.id))
    if (deletable.length === 0) return

    setIsEmptying(true)
    // Keep the linked rows on screen; the server decides the rest.
    setImages(images.filter((img) => linkedImageIds.has(img.id)))
    try {
      await permanentlyDeleteImages()
      await refetch()
    } catch (err) {
      await refetch()
      throw err
    } finally {
      setIsEmptying(false)
    }
  }, [images, linkedImageIds, refetch])

  const signFullResUrls = useCallback(
    async (imgs: Array<UserImage>): Promise<Record<string, string>> => {
      const urls: Record<string, string> = {}
      const storage = createImageStorage()
      const BATCH = 10
      for (let i = 0; i < imgs.length; i += BATCH) {
        const batch = imgs.slice(i, i + BATCH)
        const results = await Promise.all(
          batch.map((img) =>
            storage
              .getUrl(img.storage_path ?? '')
              .then((url) => ({ id: img.id, url }))
              .catch(() => ({ id: img.id, url: null })),
          ),
        )
        for (const { id, url } of results) {
          if (url) urls[id] = url
        }
      }
      return urls
    },
    [],
  )

  const deletableCount = useMemo(
    () => images.length - linkedImageIds.size,
    [images.length, linkedImageIds.size],
  )

  return {
    images,
    imageUrls,
    linkedCount: linkedImageIds.size,
    deletableCount,
    canvasLinkedIds,
    busyId,
    isEmptying,
    isBatchRunning,
    selection,
    restore,
    permanentDelete,
    restoreSelected,
    deleteSelected,
    emptyTrash,
    signFullResUrls,
  }
}
