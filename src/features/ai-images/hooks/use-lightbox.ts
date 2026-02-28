import { useState } from 'react'
import type { SavedAiImage } from '@/features/ai-images/types'

export interface LightboxState {
  index: number | null
  isOpen: boolean
  open: (img: SavedAiImage) => void
  close: () => void
  next: () => void
  prev: () => void
}

export function useLightbox(
  completedImages: Array<SavedAiImage>,
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

  return {
    index: lightboxIndex,
    isOpen: lightboxIndex !== null,
    open,
    close,
    next,
    prev,
  }
}
