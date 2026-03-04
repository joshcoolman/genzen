import { useState } from 'react'
import type { SavedAiImage } from '@/features/ai-images/types'

export interface LightboxState {
  index: number | null
  isOpen: boolean
  open: (img: SavedAiImage) => void
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

  function open(img: SavedAiImage) {
    const idx = completedImages.findIndex((i) => i.id === img.id)
    if (idx !== -1) setLightboxIndex(idx)
  }

  function close() {
    setLightboxIndex(null)
  }

  function next() {
    setLightboxIndex((i) =>
      i !== null ? (i + 1) % completedImages.length : null,
    )
  }

  function prev() {
    setLightboxIndex((i) =>
      i !== null
        ? (i - 1 + completedImages.length) % completedImages.length
        : null,
    )
  }

  function deleteAndAdvance() {
    if (lightboxIndex === null || !deleteImage) return
    const img = completedImages[lightboxIndex]
    const newLength = completedImages.length - 1
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
    open,
    close,
    next,
    prev,
    deleteAndAdvance,
  }
}
