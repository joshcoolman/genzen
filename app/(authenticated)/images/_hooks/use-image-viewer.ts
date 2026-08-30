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
  /** Hide the current image and move on -- Delete's safe twin (#545). */
  hideAndAdvance: () => void
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
  hideImage?: (img: SavedAiImage) => void,
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

  /**
   * Act on the image under the cursor and carry on through the set.
   *
   * Both verbs take the row out of the list this hook is cycling -- a delete
   * removes it, a hide makes the grid stop showing it and this list is the
   * grid's -- so the cursor has to move *before* the act rather than after.
   * Acting on the last image would otherwise leave the index one past the end.
   *
   * Staying put rather than stepping forward is the point: the next picture
   * slides into the place the last one was, which is what makes a pass through
   * a group of near-identical shots a run of single keystrokes.
   */
  function actAndAdvance(act: (img: SavedAiImage) => void) {
    if (index === null) return
    const item = items[index]
    const img = images.find((i) => i.id === item.id)
    if (!img) return
    const newLength = items.length - 1
    if (newLength === 0) close()
    else if (index >= newLength) setIndex(newLength - 1)
    act(img)
  }

  function deleteAndAdvance() {
    if (!deleteImage) return
    actAndAdvance((img) => void deleteImage(img))
  }

  /**
   * The safe verb, and the one this pass usually wants (#545).
   *
   * Sorting through near-identical takes is reducing what the grid shows, not
   * deciding anything is worthless -- and until this, the only verb in here
   * was the destructive one. That is the exact situation #504 fixed on the
   * card, arriving at the surface where the judging actually happens.
   */
  function hideAndAdvance() {
    if (!hideImage) return
    actAndAdvance((img) => hideImage(img))
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
    hideAndAdvance,
  }
}
