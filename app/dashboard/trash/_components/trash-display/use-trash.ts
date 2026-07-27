'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  listTrashedImages,
  permanentlyDeleteImages,
  restoreImages,
} from '../../_actions/trash'
import type { UserImage } from '#/features/user-images/types'
import { createImageStorage } from '#/lib/image-storage'

interface UseTrashReturn {
  images: Array<UserImage>
  imageUrls: Record<string, string>
  isLoading: boolean
  linkedImageIds: Set<string>
  linkedCounts: Record<string, number>
  canvasLinkedIds: Set<string>
  restore: (id: string) => Promise<void>
  permanentDelete: (id: string) => Promise<void>
  permanentDeleteMany: (ids: Array<string>) => Promise<void>
  restoreMany: (ids: Array<string>) => Promise<void>
  emptyTrash: () => Promise<void>
  signFullResUrls: (imgs: Array<UserImage>) => Promise<Record<string, string>>
}

/**
 * Trash list state.
 *
 * No database access and no realtime: everything goes through
 * `trash.actions.ts` (#173/#174). Trash is only ever changed by an action taken
 * on this page or by a delete elsewhere in the app, and either way the next
 * visit re-reads it -- so there is nothing here for a live subscription to do
 * that a refetch after each mutation does not.
 *
 * `linkedImageIds` drives the disabled state on the delete controls, but it is
 * not what enforces the rule. The server recomputes the linked set inside
 * `permanentlyDeleteImages` and returns the ids it actually destroyed.
 */
export function useTrash(userId: string | undefined): UseTrashReturn {
  const [images, setImages] = useState<Array<UserImage>>([])
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [linkedImageIds, setLinkedImageIds] = useState<Set<string>>(new Set())
  const [linkedCounts, setLinkedCounts] = useState<Record<string, number>>({})
  const [canvasLinkedIds, setCanvasLinkedIds] = useState<Set<string>>(new Set())

  const fetchTrashed = useCallback(async () => {
    if (!userId) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const { images: rows, links } = await listTrashedImages()

      setImages(rows)
      setLinkedImageIds(new Set(links.ids))
      setLinkedCounts(links.counts)
      setCanvasLinkedIds(new Set(links.canvasIds))

      // Sign URLs in background
      const storage = createImageStorage()
      for (const image of rows) {
        if (!image.storage_path) continue
        storage
          .getUrl(image.storage_path)
          .then((url) => {
            if (url) {
              setImageUrls((prev) => ({
                ...prev,
                [image.id]: url,
              }))
            }
          })
          .catch(() => {})
      }
    } catch {
      console.error('Failed to load trashed images')
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void fetchTrashed()
  }, [fetchTrashed])

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
        await fetchTrashed()
        throw err
      }
    },
    [fetchTrashed, forget],
  )

  const restore = useCallback(
    async (id: string) => {
      await restoreMany([id])
    },
    [restoreMany],
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
        if (deleted.length !== requested.length) await fetchTrashed()
      } catch (err) {
        await fetchTrashed()
        throw err
      }
    },
    [fetchTrashed, forget, linkedImageIds],
  )

  const permanentDelete = useCallback(
    async (id: string) => {
      await permanentDeleteMany([id])
    },
    [permanentDeleteMany],
  )

  const emptyTrash = useCallback(async () => {
    const deletable = images.filter((img) => !linkedImageIds.has(img.id))
    if (deletable.length === 0) return

    // Keep the linked rows on screen; the server decides the rest.
    setImages(images.filter((img) => linkedImageIds.has(img.id)))
    try {
      await permanentlyDeleteImages()
      await fetchTrashed()
    } catch (err) {
      await fetchTrashed()
      throw err
    }
  }, [images, linkedImageIds, fetchTrashed])

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
              .then((url) => ({
                id: img.id,
                url,
              }))
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

  return {
    images,
    imageUrls,
    isLoading,
    linkedImageIds,
    linkedCounts,
    canvasLinkedIds,
    restore,
    permanentDelete,
    permanentDeleteMany,
    restoreMany,
    emptyTrash,
    signFullResUrls,
  }
}
