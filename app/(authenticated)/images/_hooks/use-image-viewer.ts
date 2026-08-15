'use client'

import { useMemo, useState } from 'react'
import type { SavedAiImage } from '#/features/ai-images/types'
import { imageUrl } from '#/lib/image-url'

export interface ViewerItem {
  id: string
  /** Model name for a generation, filename for an upload. Alt text only. */
  title: string
}

export interface ImageViewerState {
  index: number | null
  isOpen: boolean
  items: Array<ViewerItem>
  /** Full-resolution URLs keyed by image id -- never thumbnails. */
  imageUrls: Record<string, string>
  open: (img: SavedAiImage | { id: string }) => void
  close: () => void
  next: () => void
  prev: () => void
  deleteAndAdvance: () => void
}

/**
 * A cursor over whatever the grid is currently showing.
 *
 * `images` must be that list -- filtered, sorted, and scoped to the open group
 * if there is one -- not every completed row (#270). "Next" means the next
 * picture on screen; a viewer scoped differently from the grid sends you
 * somewhere you were not looking.
 *
 * Deliberately a separate hook from Explore's `useJobView` rather than a shared
 * one. They are ~40 similar lines today, and the last time these two surfaces
 * shared code the sharing is what made /images inherit a prompt column and a
 * filmstrip nobody wanted there. Two small copies that can diverge beats one
 * that quietly imposes.
 */
export function useImageViewer(
  images: Array<SavedAiImage>,
  deleteImage?: (img: SavedAiImage) => Promise<void>,
): ImageViewerState {
  const [index, setIndex] = useState<number | null>(null)

  const { items, imageUrls } = useMemo(() => {
    const list: Array<ViewerItem> = []
    const urls: Record<string, string> = {}

    for (const img of images) {
      list.push({ id: img.id, title: img.title })
      if (img.storage_path) urls[img.id] = imageUrl(img.id)
    }

    return { items: list, imageUrls: urls }
  }, [images])

  function open(img: SavedAiImage | { id: string }) {
    const idx = items.findIndex((i) => i.id === img.id)
    if (idx !== -1) setIndex(idx)
  }

  function close() {
    setIndex(null)
  }

  // Wrapping, both directions. The set is a ring rather than a strip with two
  // dead ends: a chevron that does nothing at the last image reads as broken,
  // and there is a counter on screen saying where you are.
  function next() {
    setIndex((i) => (i !== null ? (i + 1) % items.length : null))
  }

  function prev() {
    setIndex((i) => (i !== null ? (i - 1 + items.length) % items.length : null))
  }

  function deleteAndAdvance() {
    if (index === null || !deleteImage) return
    const item = items[index]
    const img = images.find((i) => i.id === item.id)
    if (!img) return
    // The list shrinks under us, so the cursor has to move before the delete
    // rather than after: deleting the last image would otherwise leave the
    // index one past the end.
    const newLength = items.length - 1
    if (newLength === 0) close()
    else if (index >= newLength) setIndex(newLength - 1)
    void deleteImage(img)
  }

  return {
    index,
    isOpen: index !== null,
    items,
    imageUrls,
    open,
    close,
    next,
    prev,
    deleteAndAdvance,
  }
}
