import { useMemo, useState } from 'react'
import type { SavedAiImage } from '@/features/ai-images/types'
import type { EditChildrenMap } from '@/features/ai-images/hooks/use-edit-children'

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
  mergedUrls: Record<string, string>
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
  imageUrls?: Record<string, string>,
): LightboxState {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const { items, mergedUrls } = useMemo(() => {
    const flatItems: Array<LightboxItem> = []
    const urls: Record<string, string> = { ...(imageUrls ?? {}) }

    for (const img of completedImages) {
      flatItems.push({ id: img.id, title: img.title, isChild: false })

      const children = editChildrenMap?.[img.id]
      if (children) {
        for (const child of children) {
          flatItems.push({
            id: child.id,
            title: img.title,
            isChild: true,
            parentId: img.id,
          })
          if (child.url) urls[child.id] = child.url
        }
      }
    }

    return { items: flatItems, mergedUrls: urls }
  }, [completedImages, editChildrenMap, imageUrls])

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
    mergedUrls,
    open,
    close,
    next,
    prev,
    deleteAndAdvance,
  }
}
