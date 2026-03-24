import { useCallback, useEffect, useRef, useState } from 'react'
import type { SavedAiImage } from '@/features/ai-images/types'
import { supabase } from '@/lib/supabase'
import { retryGeneration } from '@/features/ai-images/server/retry-generation.server'
import { updateImageOrder } from '@/features/ai-images/server/update-image-order.server'
import { checkPendingGenerations } from '@/lib/server/check-pending-generations.server'

interface UseImagesOptions {
  userId: string | undefined
  accessToken: string | undefined
}

function sortByOrder(images: Array<SavedAiImage>): Array<SavedAiImage> {
  // Map each root/parent to its newest descendant's created_at
  const newestDescendant = new Map<string, number>()
  for (const img of images) {
    const meta = img.generation_metadata
    const rootId = meta?.root_image_id ?? meta?.source_image_id
    if (rootId) {
      const t = new Date(img.created_at).getTime() / 1000
      const current = newestDescendant.get(rootId) ?? 0
      if (t > current) newestDescendant.set(rootId, t)
    }
  }

  return [...images].sort((a, b) => {
    const aOwn = a.sort_order ?? new Date(a.created_at).getTime() / 1000
    const bOwn = b.sort_order ?? new Date(b.created_at).getTime() / 1000
    const aEffective = Math.max(aOwn, newestDescendant.get(a.id) ?? 0)
    const bEffective = Math.max(bOwn, newestDescendant.get(b.id) ?? 0)
    return bEffective - aEffective
  })
}

export interface GalleryState {
  images: Array<SavedAiImage>
  imageUrls: Record<string, string>
  rootImageMeta: Record<string, { hidden: boolean }>
  loadingGallery: boolean
  deleteImage: (img: SavedAiImage) => Promise<void>
  deleteImageWithDescendants: (img: SavedAiImage) => Promise<void>
  deleteAndDetachChildren: (img: SavedAiImage) => Promise<void>
  restoreRootImage: (rootId: string) => Promise<void>
  addOptimisticCard: (card: SavedAiImage) => void
  replaceOptimisticCard: (optimisticId: string, realCard: SavedAiImage) => void
  removeOptimisticCard: (optimisticId: string) => void
  reorderImages: (draggedId: string, newSortOrder: number) => Promise<void>
  ungroupChildren: (img: SavedAiImage) => Promise<void>
  retryImage: (img: SavedAiImage) => Promise<void>
  refresh: () => Promise<void>
}

export function useImages({
  userId,
  accessToken,
}: UseImagesOptions): GalleryState {
  const [savedImages, setSavedImages] = useState<Array<SavedAiImage>>([])
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [rootImageMeta, setRootImageMeta] = useState<
    Record<string, { hidden: boolean }>
  >({})
  const [loadingGallery, setLoadingGallery] = useState(true)

  const loadSavedImages = useCallback(async () => {
    if (!userId) return

    try {
      setLoadingGallery(true)
      const { data, error: queryError } = await supabase
        .from('user_images')
        .select(
          'id, title, description, storage_path, created_at, sort_order, status, generation_error, generation_metadata',
        )
        .eq('user_id', userId)
        .in('source', ['upload', 'ai_generated'])
        .is('deleted_at', null)
        .order('sort_order', { ascending: false, nullsFirst: false })

      if (queryError) throw queryError

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const allImages = (data ?? []) as Array<SavedAiImage>
      const images = sortByOrder(allImages)
      setSavedImages(images)
      setLoadingGallery(false)

      // Batch signed URL generation
      const completedWithPath = images.filter(
        (img) => img.status === 'completed' && img.storage_path,
      )
      const urlEntries = await Promise.all(
        completedWithPath.map(async (img) => {
          const { data: urlData } = await supabase.storage
            .from('user-images')
            .createSignedUrl(img.storage_path!, 86400, {
              transform: { width: 400, resize: 'contain', quality: 80 },
            })
          return urlData ? ([img.id, urlData.signedUrl] as const) : null
        }),
      )
      const urls: Record<string, string> = {}
      for (const entry of urlEntries) {
        if (entry) urls[entry[0]] = entry[1]
      }
      setImageUrls(urls)

      // Fetch root image URLs for variations (including hidden roots)
      const rootIds = new Set<string>()
      for (const img of images) {
        const meta = img.generation_metadata
        if (meta?.generation_type === 'variation') {
          const rootId = meta.root_image_id ?? meta.source_image_id
          if (rootId && !urls[rootId]) rootIds.add(rootId)
        }
      }
      if (rootIds.size > 0) {
        const { data: rootRows } = await supabase
          .from('user_images')
          .select('id, storage_path, hidden')
          .in('id', Array.from(rootIds))
          .is('deleted_at', null)
        if (rootRows) {
          const meta: Record<string, { hidden: boolean }> = {}
          const rootUrlEntries = await Promise.all(
            rootRows
              .filter((r) => r.storage_path)
              .map(async (r) => {
                const { data: urlData } = await supabase.storage
                  .from('user-images')
                  .createSignedUrl(r.storage_path, 86400, {
                    transform: { width: 400, resize: 'contain', quality: 80 },
                  })
                return urlData ? ([r.id, urlData.signedUrl] as const) : null
              }),
          )
          for (const r of rootRows) {
            meta[r.id] = { hidden: !!r.hidden }
          }
          const rootUrls: Record<string, string> = {}
          for (const entry of rootUrlEntries) {
            if (entry) rootUrls[entry[0]] = entry[1]
          }
          setImageUrls((prev) => ({ ...prev, ...rootUrls }))
          setRootImageMeta(meta)
        }
      }
    } catch {
      console.error('Failed to load saved AI images')
    } finally {
      setLoadingGallery(false)
    }
  }, [userId])

  useEffect(() => {
    loadSavedImages()
  }, [loadSavedImages])

  // Realtime subscription for user_images table
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('user_images_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_images',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newImage = payload.new as SavedAiImage
            // Only include uploads and ai_generated sources
            const rawInsert = payload.new as Record<string, unknown>
            if (
              rawInsert.source !== 'upload' &&
              rawInsert.source !== 'ai_generated'
            )
              return
            // Bump parent's sort_order when a child is added
            const parentId = newImage.generation_metadata?.source_image_id
            const bumpedSort = Date.now() / 1000

            setSavedImages((prev) => {
              if (prev.some((img) => img.id === newImage.id)) return prev
              const metadata = newImage.generation_metadata
              if (
                metadata?.generation_type === 'variation' &&
                metadata.source_image_id
              ) {
                const sourceId = metadata.source_image_id
                const optimisticIdx = prev.findIndex((img) =>
                  img.id.startsWith(`optimistic-${sourceId}-`),
                )
                if (optimisticIdx !== -1) {
                  const updated = [...prev]
                  updated[optimisticIdx] = newImage
                  // Also bump parent
                  if (parentId) {
                    const pi = updated.findIndex((i) => i.id === parentId)
                    if (pi !== -1)
                      updated[pi] = {
                        ...updated[pi],
                        sort_order: bumpedSort,
                      }
                  }
                  return sortByOrder(updated)
                }
              }
              // Bump parent in the list
              let next = [...prev, newImage]
              if (parentId) {
                next = next.map((i) =>
                  i.id === parentId ? { ...i, sort_order: bumpedSort } : i,
                )
              }
              return sortByOrder(next)
            })

            // Persist parent bump to DB
            if (parentId) {
              void supabase
                .from('user_images')
                .update({ sort_order: bumpedSort })
                .eq('id', parentId)
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedImage = payload.new as SavedAiImage
            const rawUpdate = payload.new as Record<string, unknown>
            if (updatedImage.deleted_at || rawUpdate.hidden === true) {
              setSavedImages((prev) =>
                prev.filter((img) => img.id !== updatedImage.id),
              )
              setImageUrls((prev) => {
                const next = { ...prev }
                delete next[updatedImage.id]
                return next
              })
              return
            }
            setSavedImages((prev) => {
              const exists = prev.some((img) => img.id === updatedImage.id)
              if (exists) {
                return prev.map((img) =>
                  img.id === updatedImage.id ? updatedImage : img,
                )
              }
              // Image was restored from trash -- re-add to gallery
              return sortByOrder([...prev, updatedImage])
            })

            if (
              updatedImage.status === 'completed' &&
              updatedImage.storage_path
            ) {
              supabase.storage
                .from('user-images')
                .createSignedUrl(updatedImage.storage_path, 86400, {
                  transform: { width: 400, resize: 'contain', quality: 80 },
                })
                .then(({ data }) => {
                  if (data) {
                    setImageUrls((prev) => ({
                      ...prev,
                      [updatedImage.id]: data.signedUrl,
                    }))
                  }
                })
                .catch(() => {
                  // Signed URL fetch failed — image will show on next full reload
                })
            }
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id
            setSavedImages((prev) => prev.filter((img) => img.id !== deletedId))
            setImageUrls((prev) => {
              const next = { ...prev }
              delete next[deletedId]
              return next
            })
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  // Poll FAL for pending generations
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!accessToken) return

    const hasPending = savedImages.some((img) => img.status === 'pending')

    if (hasPending && !pollingRef.current) {
      // Initial check immediately
      checkPendingGenerations({ data: { accessToken } }).catch(() => {})
      pollingRef.current = setInterval(() => {
        checkPendingGenerations({ data: { accessToken } }).catch(() => {})
      }, 5000)
    } else if (!hasPending && pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [accessToken, savedImages.some((img) => img.status === 'pending')])

  function addOptimisticCard(card: SavedAiImage) {
    setSavedImages((prev) => sortByOrder([...prev, card]))
  }

  function replaceOptimisticCard(optimisticId: string, realCard: SavedAiImage) {
    setSavedImages((prev) => {
      const filtered = prev.filter(
        (i) => i.id !== optimisticId && i.id !== realCard.id,
      )
      return sortByOrder([...filtered, realCard])
    })
  }

  function removeOptimisticCard(optimisticId: string) {
    setSavedImages((prev) => prev.filter((i) => i.id !== optimisticId))
  }

  async function deleteImage(img: SavedAiImage) {
    setSavedImages((prev) => prev.filter((i) => i.id !== img.id))

    try {
      // Check if this image has living variations (is a root/source)
      const { count: variationCount } = await supabase
        .from('user_images')
        .select('id', { count: 'exact', head: true })
        .or(
          `generation_metadata->>root_image_id.eq.${img.id},generation_metadata->>source_image_id.eq.${img.id}`,
        )
        .is('deleted_at', null)
        .eq('hidden', false)

      if (variationCount && variationCount > 0) {
        // Hide instead of soft-delete — variations still need this image
        const { error: hideError } = await supabase
          .from('user_images')
          .update({ hidden: true })
          .eq('id', img.id)
        if (hideError) throw hideError
      } else {
        // Normal soft delete
        const { error: deleteError } = await supabase
          .from('user_images')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', img.id)
        if (deleteError) throw deleteError
      }

      // If this image is a variation, check if its root should be cleaned up
      const metadata = img.generation_metadata
      if (metadata?.generation_type === 'variation') {
        const rootId = metadata.root_image_id ?? metadata.source_image_id
        if (rootId) {
          await cleanupHiddenRoot(rootId, img.id)
        }
      }
    } catch {
      loadSavedImages()
    }
  }

  async function cleanupHiddenRoot(rootId: string, excludeId: string) {
    // Check if root is hidden
    const { data: rootImage } = await supabase
      .from('user_images')
      .select('id, storage_path, hidden')
      .eq('id', rootId)
      .single()

    if (!rootImage?.hidden) return

    // Check for other living variations
    const { count } = await supabase
      .from('user_images')
      .select('id', { count: 'exact', head: true })
      .or(
        `generation_metadata->>root_image_id.eq.${rootId},generation_metadata->>source_image_id.eq.${rootId}`,
      )
      .is('deleted_at', null)
      .neq('id', excludeId)

    if (count === 0) {
      // No more living variations — permanently delete the hidden root
      await supabase.from('user_images').delete().eq('id', rootId)
      if (rootImage.storage_path) {
        await supabase.storage
          .from('user-images')
          .remove([rootImage.storage_path])
      }
    }
  }

  async function deleteImageWithDescendants(img: SavedAiImage) {
    // Collect all descendant IDs via BFS
    const { data: allRows } = await supabase
      .from('user_images')
      .select('id, generation_metadata')
      .eq('user_id', userId!)
      .is('deleted_at', null)

    const childrenOf = new Map<string, Array<string>>()
    for (const row of allRows ?? []) {
      const meta = row.generation_metadata as Record<string, unknown> | null
      const srcId = meta?.source_image_id as string | undefined
      if (srcId) {
        const siblings = childrenOf.get(srcId) ?? []
        siblings.push(row.id)
        childrenOf.set(srcId, siblings)
      }
    }

    const idsToDelete = new Set<string>([img.id])
    const queue = [img.id]
    while (queue.length > 0) {
      const current = queue.shift()!
      for (const childId of childrenOf.get(current) ?? []) {
        if (!idsToDelete.has(childId)) {
          idsToDelete.add(childId)
          queue.push(childId)
        }
      }
    }

    // Optimistic removal
    setSavedImages((prev) => prev.filter((i) => !idsToDelete.has(i.id)))
    setImageUrls((prev) => {
      const next = { ...prev }
      for (const id of idsToDelete) delete next[id]
      return next
    })

    try {
      const now = new Date().toISOString()
      await supabase
        .from('user_images')
        .update({ deleted_at: now })
        .in('id', Array.from(idsToDelete))
    } catch {
      loadSavedImages()
    }
  }

  async function deleteAndDetachChildren(img: SavedAiImage) {
    // Find direct children and remove their source_image_id, then delete parent
    const { data: allRows } = await supabase
      .from('user_images')
      .select('id, generation_metadata')
      .eq('user_id', userId!)
      .is('deleted_at', null)

    const directChildren = (allRows ?? []).filter((row) => {
      const meta = row.generation_metadata as Record<string, unknown> | null
      return meta?.source_image_id === img.id
    })

    // Detach each direct child
    await Promise.all(
      directChildren.map(async (child) => {
        const raw = (child.generation_metadata ?? {}) as Record<string, unknown>
        const meta = { ...raw }
        delete meta.source_image_id
        delete meta.generation_type
        delete meta.root_image_id
        await supabase
          .from('user_images')
          .update({
            generation_metadata: meta as unknown as Record<string, never>,
          })
          .eq('id', child.id)
      }),
    )

    // Update local state: detach children + remove parent
    const detachedIds = new Set(directChildren.map((c) => c.id))
    setSavedImages((prev) =>
      prev
        .filter((i) => i.id !== img.id)
        .map((i) => {
          if (!detachedIds.has(i.id)) return i
          const meta = i.generation_metadata
            ? { ...i.generation_metadata }
            : null
          if (meta) {
            delete (meta as Record<string, unknown>).source_image_id
            delete (meta as Record<string, unknown>).generation_type
            delete (meta as Record<string, unknown>).root_image_id
          }
          return { ...i, generation_metadata: meta }
        }),
    )
    try {
      const { error: deleteError } = await supabase
        .from('user_images')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', img.id)
      if (deleteError) throw deleteError
    } catch {
      loadSavedImages()
    }
  }

  async function restoreRootImage(rootId: string) {
    const { error } = await supabase
      .from('user_images')
      .update({ hidden: false })
      .eq('id', rootId)
    if (!error) {
      setRootImageMeta((prev) => {
        const next = { ...prev }
        delete next[rootId]
        return next
      })
    }
  }

  async function retryImage(img: SavedAiImage) {
    if (!accessToken) return
    // Optimistically remove the failed card — the new pending record will appear via realtime
    setSavedImages((prev) => prev.filter((i) => i.id !== img.id))
    try {
      await retryGeneration({ data: { accessToken, recordId: img.id } })
    } catch {
      // If retry fails, restore the failed card
      setSavedImages((prev) => sortByOrder([...prev, img]))
    }
  }

  async function ungroupChildren(img: SavedAiImage) {
    // Detach all direct children to top-level without deleting the parent
    const { data: allRows } = await supabase
      .from('user_images')
      .select('id, generation_metadata')
      .eq('user_id', userId!)
      .is('deleted_at', null)

    const directChildren = (allRows ?? []).filter((row) => {
      const meta = row.generation_metadata as Record<string, unknown> | null
      return meta?.source_image_id === img.id
    })

    if (directChildren.length === 0) return

    // Detach each direct child
    await Promise.all(
      directChildren.map(async (child) => {
        const raw = (child.generation_metadata ?? {}) as Record<string, unknown>
        const meta = { ...raw }
        delete meta.source_image_id
        delete meta.generation_type
        delete meta.root_image_id
        await supabase
          .from('user_images')
          .update({
            generation_metadata: meta as unknown as Record<string, never>,
          })
          .eq('id', child.id)
      }),
    )

    // Update local state: detach children, keep parent
    const detachedIds = new Set(directChildren.map((c) => c.id))
    setSavedImages((prev) =>
      prev.map((i) => {
        if (!detachedIds.has(i.id)) return i
        const meta = i.generation_metadata ? { ...i.generation_metadata } : null
        if (meta) {
          delete (meta as Record<string, unknown>).source_image_id
          delete (meta as Record<string, unknown>).generation_type
          delete (meta as Record<string, unknown>).root_image_id
        }
        return { ...i, generation_metadata: meta }
      }),
    )
  }

  async function reorderImages(draggedId: string, newSortOrder: number) {
    if (!accessToken) return

    const prev = savedImages
    setSavedImages((current) =>
      sortByOrder(
        current.map((img) =>
          img.id === draggedId ? { ...img, sort_order: newSortOrder } : img,
        ),
      ),
    )

    try {
      await updateImageOrder({
        data: { accessToken, imageId: draggedId, sortOrder: newSortOrder },
      })
    } catch {
      setSavedImages(prev)
    }
  }

  return {
    images: savedImages,
    imageUrls,
    rootImageMeta,
    loadingGallery,
    deleteImage,
    deleteImageWithDescendants,
    deleteAndDetachChildren,
    ungroupChildren,
    restoreRootImage,
    addOptimisticCard,
    replaceOptimisticCard,
    removeOptimisticCard,
    reorderImages,
    retryImage,
    refresh: loadSavedImages,
  }
}
