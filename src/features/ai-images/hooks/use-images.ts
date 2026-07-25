import { useCallback, useEffect, useRef, useState } from 'react'
import type { SavedAiImage } from '@/features/ai-images/types'
import type { Tables } from '@/lib/types/supabase'
import { supabase } from '@/lib/supabase'
import { retryGeneration } from '@/features/ai-images/server/retry-generation.server'
import { updateImageOrder } from '@/features/ai-images/server/update-image-order.server'
import { checkPendingGenerations } from '@/lib/server/check-pending-generations.server'
import { createImageStorage } from '@/lib/image-storage'
import { removeImages } from '@/features/user-images/server/remove-images.server'
import { ungroupImages } from '@/features/ai-images/server/ungroup-images.server'

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
  setImageUrl: (id: string, url: string) => void
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
          'id, title, description, storage_path, thumbnail_path, created_at, sort_order, status, generation_error, generation_metadata',
        )
        .eq('user_id', userId)
        .in('source', ['upload', 'ai_generated'])
        .is('deleted_at', null)
        .order('sort_order', { ascending: false, nullsFirst: false })

      if (queryError) throw queryError

      const allImages = data as Array<SavedAiImage>
      const images = sortByOrder(allImages)
      setSavedImages(images)
      setLoadingGallery(false)

      // Batch signed URL generation
      const completedWithPath = images.filter(
        (img) => img.status === 'completed' && img.storage_path,
      )
      const urlEntries = await Promise.all(
        completedWithPath.map(async (img) => {
          const path = img.thumbnail_path ?? img.storage_path!
          const url = await createImageStorage().getUrl(path)
          return url ? ([img.id, url] as const) : null
        }),
      )
      const urls: Record<string, string> = {}
      for (const entry of urlEntries) {
        if (entry) urls[entry[0]] = entry[1]
      }
      setImageUrls(urls)

      // Fetch source image URLs for edits and variations (including hidden sources)
      const rootIds = new Set<string>()
      for (const img of images) {
        const meta = img.generation_metadata
        const generationType = meta?.generation_type
        if (generationType === 'edit' || generationType === 'variation') {
          // Use source_image_id (immutable generation history)
          const sourceId = meta?.source_image_id
          if (sourceId && !urls[sourceId]) rootIds.add(sourceId)
        }
      }
      if (rootIds.size > 0) {
        const { data: rootRows } = await supabase
          .from('user_images')
          .select('id, storage_path, thumbnail_path, hidden')
          .in('id', Array.from(rootIds))
          .is('deleted_at', null)
        if (rootRows) {
          const meta: Record<string, { hidden: boolean }> = {}
          const rootUrlEntries = await Promise.all(
            (rootRows as Array<RootImageRow>).map(async (r) => {
              const storagePath = r.storage_path
              if (!storagePath) return null
              const path = r.thumbnail_path ?? storagePath
              const url = await createImageStorage().getUrl(path)
              return url ? ([r.id, url] as const) : null
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

              // Check if this is a realtime echo of an optimistic upload.
              // Match by title (file name) to find the correct optimistic card
              // when multiple files are uploading in parallel.
              const isOptimistic = (img: SavedAiImage) =>
                img.id.startsWith('upload-') || img.id.startsWith('paste-')
              if (newImage.storage_path && prev.some(isOptimistic)) {
                const optimisticIdx = prev.findIndex(
                  (img) => isOptimistic(img) && img.title === newImage.title,
                )
                if (optimisticIdx !== -1) {
                  // Silently swap temp ID for real ID, same position
                  return prev.map((img, i) =>
                    i === optimisticIdx ? newImage : img,
                  )
                }
              }

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
              const path =
                updatedImage.thumbnail_path ?? updatedImage.storage_path
              createImageStorage()
                .getUrl(path)
                .then((url) => {
                  if (url) {
                    setImageUrls((prev) => ({
                      ...prev,
                      [updatedImage.id]: url,
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

  // Poll FAL for pending generations (skipped when webhooks are enabled)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (import.meta.env.VITE_ENABLE_FAL_WEBHOOKS === 'true') return
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
    setSavedImages((prev) => [card, ...prev])
  }

  function replaceOptimisticCard(optimisticId: string, realCard: SavedAiImage) {
    setSavedImages((prev) =>
      prev.map((i) => (i.id === optimisticId ? realCard : i)),
    )
  }

  function removeOptimisticCard(optimisticId: string) {
    setSavedImages((prev) => prev.filter((i) => i.id !== optimisticId))
  }

  function setImageUrl(id: string, url: string) {
    setImageUrls((prev) => ({ ...prev, [id]: url }))
  }

  async function deleteImage(img: SavedAiImage) {
    if (img.storage_path) createImageStorage().invalidateUrl(img.storage_path)
    if (img.thumbnail_path)
      createImageStorage().invalidateUrl(img.thumbnail_path)
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
      .select('id, storage_path, thumbnail_path, hidden')
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
        const paths = [
          rootImage.storage_path,
          ...(rootImage.thumbnail_path ? [rootImage.thumbnail_path] : []),
        ]
        await removeImages({
          data: { accessToken: accessToken!, storagePaths: paths },
        })
      }
    }
  }

  async function deleteImageWithDescendants(img: SavedAiImage) {
    // Collect group children via BFS on parent_id (grouping, not genealogy)
    const { data: allRows } = await supabase
      .from('user_images')
      .select('id, generation_metadata')
      .eq('user_id', userId!)
      .is('deleted_at', null)

    const childrenOf = new Map<string, Array<string>>()
    for (const row of allRows ?? []) {
      const meta = row.generation_metadata as Record<string, unknown> | null
      const pid = meta?.parent_id as string | undefined
      if (pid) {
        const siblings = childrenOf.get(pid) ?? []
        siblings.push(row.id)
        childrenOf.set(pid, siblings)
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
      // Remove parent_id from children so they're independent in trash
      // Genealogy fields (source_image_id, root_image_id, generation_type) stay intact
      const childIds = Array.from(idsToDelete).filter((id) => id !== img.id)
      if (childIds.length > 0 && accessToken) {
        await ungroupImages({
          data: { accessToken, imageIds: childIds },
        })
      }

      // Soft-delete all
      await supabase
        .from('user_images')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', Array.from(idsToDelete))
    } catch {
      loadSavedImages()
    }
  }

  async function deleteAndDetachChildren(img: SavedAiImage) {
    // Optimistic: remove parent from view, clear parent_id on children
    setSavedImages((prev) =>
      prev
        .filter((i) => i.id !== img.id)
        .map((i) => {
          if (i.generation_metadata?.parent_id !== img.id) return i
          return {
            ...i,
            generation_metadata: {
              ...i.generation_metadata,
              parent_id: undefined,
            },
          }
        }),
    )

    try {
      // Detach all children via server function
      if (accessToken) {
        await ungroupImages({
          data: { accessToken, parentId: img.id },
        })
      }

      // Soft-delete the parent
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
    if (!accessToken) return

    // Optimistic: clear parent_id on children in local state
    setSavedImages((prev) =>
      prev.map((i) => {
        if (i.generation_metadata?.parent_id !== img.id) return i
        return {
          ...i,
          generation_metadata: {
            ...i.generation_metadata,
            parent_id: undefined,
          },
        }
      }),
    )

    // Detach all children via server function
    await ungroupImages({
      data: { accessToken, parentId: img.id },
    })
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
    setImageUrl,
    reorderImages,
    retryImage,
    refresh: loadSavedImages,
  }
}
type RootImageRow = Pick<
  Tables<'user_images'>,
  'id' | 'storage_path' | 'thumbnail_path' | 'hidden'
>
