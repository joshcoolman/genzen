import { useCallback, useEffect, useState } from 'react'
import type { UserImage } from '../types'
import { supabase } from '@/lib/supabase'

const BUCKET_NAME = 'user-images'

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
        const { data, error: urlError } = await supabase.storage
          .from(BUCKET_NAME)
          .createSignedUrl(image.storage_path, 3600)

        if (!urlError) {
          setImageUrls((prev) => ({ ...prev, [image.id]: data.signedUrl }))
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

      const { data, error: fetchError } = await supabase
        .from('user_images')
        .select('*')
        .eq('user_id', userId)
        .in('source', ['upload', 'ai_generated'])
        .order('created_at', { ascending: false })

      if (fetchError) throw new Error(fetchError.message)

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
