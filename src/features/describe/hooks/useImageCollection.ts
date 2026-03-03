import { useCallback, useEffect, useState } from 'react'
import type { CollectedImage } from '../types'

const STORAGE_KEY = 'describe-collection'
const TTL_MS = 60 * 60 * 1000 // 1 hour

interface StoredCollection {
  images: Array<CollectedImage>
  timestamp: number
}

function loadFromStorage(): Array<CollectedImage> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const stored: StoredCollection = JSON.parse(raw)
    if (Date.now() - stored.timestamp > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return []
    }
    return stored.images
  } catch {
    return []
  }
}

function saveToStorage(images: Array<CollectedImage>) {
  if (images.length === 0) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  const stored: StoredCollection = { images, timestamp: Date.now() }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
}

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
  const [images, setImages] = useState<Array<CollectedImage>>(loadFromStorage)

  useEffect(() => {
    saveToStorage(images)
  }, [images])

  const imageIds = new Set(images.map((img) => img.id))

  const add = useCallback((image: CollectedImage) => {
    setImages((prev) => {
      if (prev.some((img) => img.id === image.id)) return prev
      return [image, ...prev]
    })
  }, [])

  const addMany = useCallback((newImages: Array<CollectedImage>) => {
    setImages((prev) => {
      const existingIds = new Set(prev.map((img) => img.id))
      const toAdd = newImages.filter((img) => !existingIds.has(img.id))
      if (toAdd.length === 0) return prev
      return [...toAdd, ...prev]
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
