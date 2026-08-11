'use client'

import { useMemo, useState } from 'react'
import type { SavedAiImage } from '#/features/ai-images/types'
import { imageUrl } from '#/lib/image-url'

export interface LightboxItem {
  id: string
  /** Model name for a generation, filename for an upload. */
  title: string
  /** What was sent to the provider (#271). Absent on an upload. */
  prompt?: string
}

export interface LightboxState {
  index: number | null
  isOpen: boolean
  items: Array<LightboxItem>
  /** Full-resolution URLs keyed by image id -- always uses storage_path, never thumbnails */
  imageUrls: Record<string, string>
  /** Thumbnails for the filmstrip; a rail of full-res images would be absurd. */
  thumbnailUrls: Record<string, string>
  open: (img: SavedAiImage | { id: string }) => void
  close: () => void
  select: (index: number) => void
  next: () => void
  prev: () => void
  deleteAndAdvance: () => void
}

/**
 * `images` must be the list the grid is rendering -- filtered and sorted --
 * not every completed row (#270). The filmstrip shows this list, so a lightbox
 * scoped differently from the grid is visibly wrong rather than subtly wrong.
 */
export function useLightbox(
  images: Array<SavedAiImage>,
  deleteImage?: (img: SavedAiImage) => Promise<void>,
): LightboxState {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const { items, imageUrls, thumbnailUrls } = useMemo(() => {
    const flatItems: Array<LightboxItem> = []
    const urls: Record<string, string> = {}
    const thumbs: Record<string, string> = {}

    for (const img of images) {
      flatItems.push({
        id: img.id,
        title: img.title,
        prompt: img.generation_metadata?.prompt,
      })
      // Full-res in the lightbox, never the thumbnail.
      if (img.storage_path) {
        urls[img.id] = imageUrl(img.id)
        thumbs[img.id] = imageUrl(img.id, 'thumb')
      }
    }

    return { items: flatItems, imageUrls: urls, thumbnailUrls: thumbs }
  }, [images])

  function open(img: SavedAiImage | { id: string }) {
    const idx = items.findIndex((i) => i.id === img.id)
    if (idx !== -1) setLightboxIndex(idx)
  }

  function close() {
    setLightboxIndex(null)
  }

  function select(index: number) {
    if (index >= 0 && index < items.length) setLightboxIndex(index)
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
    const img = images.find((i) => i.id === item.id)
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
    thumbnailUrls,
    open,
    close,
    select,
    next,
    prev,
    deleteAndAdvance,
  }
}
