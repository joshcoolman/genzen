'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  listTrashedImages,
  permanentlyDeleteImages,
  restoreImages,
} from './_actions/trash'
import type { UserImage } from '#/features/user-images/types'
import { imageUrl } from '#/lib/image-url'
import { useSelection } from '#/lib/use-selection'

/**
 * Trash list state.
 *
 * The first read is the server component's -- `page.tsx` runs
 * `listTrashedImages()` and hands the rows in as `initial`, so there is no
 * loading state and no empty first paint. This hook owns every read after
 * that: each mutation is optimistic and then refetches, which is why the
 * server payload is a seed rather than the source of truth.
 *
 * No realtime (#174). Trash only changes from an action on this page or a
 * delete elsewhere, and either way the next visit re-reads it.
 *
 * Every row here is deletable (#446). There is no canvas lock and no badge:
 * trashing takes the image off every board it was on, so nothing in the bin is
 * being held for something the user would have to go and find.
 */
export function useView(initial: Array<UserImage>) {
  const [images, setImages] = useState<Array<UserImage>>(initial)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isEmptying, setIsEmptying] = useState(false)
  const [isBatchRunning, setIsBatchRunning] = useState(false)

  const selection = useSelection({ items: images.map((img) => img.id) })

  /** A URL names the row, so this is a derivation rather than a fan-out of
   *  storage calls that had to arrive one at a time (#226). */
  const signInBackground = useCallback((rows: Array<UserImage>) => {
    const next: Record<string, string> = {}
    for (const image of rows) {
      if (image.storage_path) next[image.id] = imageUrl(image.id, 'thumb')
    }
    setImageUrls((prev) => ({ ...prev, ...next }))
  }, [])

  useEffect(() => {
    signInBackground(initial)
  }, [initial, signInBackground])

  const refetch = useCallback(async () => {
    try {
      const rows = await listTrashedImages()
      setImages(rows)
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
      if (ids.length === 0) return

      forget(new Set(ids))
      try {
        const deleted = await permanentlyDeleteImages(ids)
        // A row can go from another tab between the load and the click, so
        // re-read rather than trust the optimism when the counts disagree.
        if (deleted.length !== ids.length) await refetch()
      } catch (err) {
        await refetch()
        throw err
      }
    },
    [forget, refetch],
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
    if (images.length === 0) return

    setIsEmptying(true)
    setImages([])
    try {
      await permanentlyDeleteImages()
      await refetch()
    } catch (err) {
      await refetch()
      throw err
    } finally {
      setIsEmptying(false)
    }
  }, [images, refetch])

  const signFullResUrls = useCallback(
    async (imgs: Array<UserImage>): Promise<Record<string, string>> => {
      const urls: Record<string, string> = {}
      {
        for (const img of imgs) {
          if (img.storage_path) urls[img.id] = imageUrl(img.id)
        }
      }
      return urls
    },
    [],
  )

  return {
    images,
    imageUrls,
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
