'use client'

import { useMemo, useState } from 'react'
import type { SavedAiImage } from '#/features/ai-images/types'
import type { EditChildrenMap } from '#/features/ai-images/hooks/use-edit-children'
import { getR2PublicUrl } from '#/lib/image-storage'

export interface LightboxItem {
  id: string
  title: string
  isChild: boolean
  parentId?: string
}

export interface LightboxState {
  index: number | null
  isOpen: boolean
  items: Array<LightboxItem>
  /** Full-resolution URLs keyed by image id -- always uses storage_path, never thumbnails */
  imageUrls: Record<string, string>
  open: (img: SavedAiImage | { id: string }) => void
  close: () => void
  next: () => void
  prev: () => void
  deleteAndAdvance: () => void
}

export function useLightbox(
  completedImages: Array<SavedAiImage>,
  deleteImage?: (img: SavedAiImage) => Promise<void>,
  editChildrenMap?: EditChildrenMap,
): LightboxState {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const { items, imageUrls } = useMemo(() => {
    const flatItems: Array<LightboxItem> = []
    const urls: Record<string, string> = {}

    for (const img of completedImages) {
      flatItems.push({
        id: img.id,
        title: img.title,
        isChild: false,
      })
      // Always use storage_path (full-res) for lightbox
      if (img.storage_path) {
        urls[img.id] = getR2PublicUrl(img.storage_path)
      }

      const children = editChildrenMap?.[img.id]
      if (children) {
        for (const child of children) {
          flatItems.push({
            id: child.id,
            title: img.title,
            isChild: true,
            parentId: img.id,
          })
          // Use storagePath (full-res) for children too
          if (child.storagePath) {
            urls[child.id] = getR2PublicUrl(child.storagePath)
          } else if (child.url) {
            urls[child.id] = child.url
          }
        }
      }
    }

    return { items: flatItems, imageUrls: urls }
  }, [completedImages, editChildrenMap])

  function open(img: SavedAiImage | { id: string }) {
    const idx = items.findIndex((i) => i.id === img.id)
    if (idx !== -1) setLightboxIndex(idx)
  }

  function close() {
    setLightboxIndex(null)
  }

  function next() {
    setLightboxIndex((i) => (i !== null ? (i + 1) % items.length : null))
  }

  function prev() {
    setLightboxIndex((i) =>
      i !== null ? (i - 1 + items.length) % items.length : null,
    )
  }

  function deleteAndAdvance() {
    if (lightboxIndex === null || !deleteImage) return
    const item = items[lightboxIndex]
    const img = completedImages.find((i) => i.id === item.id)
    if (!img) return
    const newLength = items.length - 1
    if (newLength === 0) {
      close()
    } else if (lightboxIndex >= newLength) {
      setLightboxIndex(newLength - 1)
    }
    deleteImage(img)
  }

  return {
    index: lightboxIndex,
    isOpen: lightboxIndex !== null,
    items,
    imageUrls,
    open,
    close,
    next,
    prev,
    deleteAndAdvance,
  }
}
