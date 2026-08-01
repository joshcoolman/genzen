'use client'

import { useCallback, useEffect, useState } from 'react'
import { listImages } from '../server/images.actions'
import type { UserImage } from '../types'
import { imageUrl } from '#/lib/image-url'

interface UseExistingImagesReturn {
  images: Array<UserImage>
  imageUrls: Record<string, string>
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useExistingImages(
  userId: string | undefined,
): UseExistingImagesReturn {
  const [images, setImages] = useState<Array<UserImage>>([])
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadImageUrls = useCallback((imgs: Array<UserImage>) => {
    const next: Record<string, string> = {}
    for (const image of imgs) {
      if (image.storage_path) next[image.id] = imageUrl(image.id, 'thumb')
    }
    setImageUrls((prev) => ({ ...prev, ...next }))
  }, [])

  const fetchImages = useCallback(async () => {
    if (!userId) return

    try {
      setIsLoading(true)
      setError(null)

      const data = await listImages()

      setImages(data)

      if (data.length > 0) {
        loadImageUrls(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load images')
    } finally {
      setIsLoading(false)
    }
  }, [userId, loadImageUrls])

  useEffect(() => {
    fetchImages()
  }, [fetchImages])

  return { images, imageUrls, isLoading, error, refresh: fetchImages }
}
