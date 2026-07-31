'use client'

import { useMemo, useState } from 'react'
import type { SavedAiImage } from '#/features/ai-images/types'
import { imageUrl } from '#/lib/image-url'

export interface LightboxItem {
  id: string
  title: string
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
): LightboxState {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const { items, imageUrls } = useMemo(() => {
    const flatItems: Array<LightboxItem> = []
    const urls: Record<string, string> = {}

    for (const img of completedImages) {
      flatItems.push({ id: img.id, title: img.title })
      // Full-res in the lightbox, never the thumbnail.
      if (img.storage_path) {
        urls[img.id] = imageUrl(img.id)
      }
    }

    return { items: flatItems, imageUrls: urls }
  }, [completedImages])

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
