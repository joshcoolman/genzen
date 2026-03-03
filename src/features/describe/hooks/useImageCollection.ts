import { useCallback, useState } from 'react'
import type { CollectedImage } from '../types'

interface UseImageCollectionReturn {
  images: Array<CollectedImage>
  imageIds: Set<string>
  add: (image: CollectedImage) => void
  addMany: (images: Array<CollectedImage>) => void
  remove: (id: string) => void
  clear: () => void
  count: number
}

export function useImageCollection(): UseImageCollectionReturn {
  const [images, setImages] = useState<Array<CollectedImage>>([])

  const imageIds = new Set(images.map((img) => img.id))

  const add = useCallback((image: CollectedImage) => {
    setImages((prev) => {
      if (prev.some((img) => img.id === image.id)) return prev
      return [...prev, image]
    })
  }, [])

  const addMany = useCallback((newImages: Array<CollectedImage>) => {
    setImages((prev) => {
      const existingIds = new Set(prev.map((img) => img.id))
      const toAdd = newImages.filter((img) => !existingIds.has(img.id))
      if (toAdd.length === 0) return prev
      return [...prev, ...toAdd]
    })
  }, [])

  const remove = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id))
  }, [])

  const clear = useCallback(() => {
    setImages([])
  }, [])

  return {
    images,
    imageIds,
    add,
    addMany,
    remove,
    clear,
    count: images.length,
  }
}
