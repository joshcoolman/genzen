'use client'

import { useMemo, useState } from 'react'
import type { SavedAiImage } from '#/features/ai-images/types'
import type { ViewerItem } from '#/components'
import { imageUrl } from '#/lib/image-url'
import { displayPrompt } from '#/features/ai-images/display-prompt'

/* The item shape belongs to the viewer (#690). What stays here is how an
   Images row becomes one: a generation prefers its metadata over
   `description`, which is only a copy and was for a long time a truncated one
   (#582), and it is derived exactly as the card's caption is so the two never
   disagree about the same picture. */
export type { ViewerItem }

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
 * **Still local to Images, and deliberately so.** The lightbox itself is
 * shared (`#/components`, #690), but this is not: sharing the cursor with the
 * former Explore surface is what imposed a prompt column and a filmstrip on
 * this one. A cursor carries a surface's own rules -- what the set is, what
 * Delete means, what Hide means -- and Director's sheets answer all three
 * differently, so it builds its own and hands the viewer the same four props.
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
      // An upload has no prompt; its `description` is what Describe wrote
      // (#585), and a filename in the prompt column would read as one. A
      // generation's `description` is a caption or a copy of its prompt, and
      // Describe's output lives in `image_description` beside it.
      const upload = img.origin === 'upload'
      const prompt = upload
        ? undefined
        : (displayPrompt(img.generation_metadata) ?? img.description)
      const description = upload
        ? img.description
        : img.generation_metadata?.image_description
      list.push({
        id: img.id,
        title: img.title,
        prompt: prompt ?? undefined,
        description: description ?? undefined,
      })
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
