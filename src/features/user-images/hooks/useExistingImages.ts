'use client'

import { useCallback, useEffect, useState } from 'react'
import { listImages } from '../server/images.actions'
import type { UserImage } from '../types'
import { createImageStorage } from '#/lib/image-storage'

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

  const loadImageUrls = useCallback(async (imgs: Array<UserImage>) => {
    for (const image of imgs) {
      if (!image.storage_path) continue
      try {
        const path =
          (image as { thumbnail_path?: string | null }).thumbnail_path ??
          image.storage_path
        const url = await createImageStorage().getUrl(path)
        if (url) {
          setImageUrls((prev) => ({ ...prev, [image.id]: url }))
        }
      } catch (err) {
        console.error(`Failed to load URL for image ${image.id}:`, err)
      }
    }
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
