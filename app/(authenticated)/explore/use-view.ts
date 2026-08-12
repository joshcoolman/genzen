'use client'

import { useMemo } from 'react'
import { useLightbox } from '../images/_hooks/use-lightbox'
import type { SavedAiImage } from '#/features/ai-images/types'
import { imageUrl } from '#/lib/image-url'

/**
 * No filters, no sort, no polling. Explore is a browsing surface: the rows are
 * whatever was there when the page loaded, and nothing on screen changes them.
 * /images owns every one of those controls -- duplicating them here would make
 * two places to look for the same setting.
 */
export function useView(initial: Array<SavedAiImage>) {
  // Only rows with something to look at. An in-flight or failed generation is a
  // job, and jobs belong on the working surface.
  const images = useMemo(
    () =>
      initial.filter((img) => img.status === 'completed' && img.storage_path),
    [initial],
  )

  const thumbnailUrls = useMemo(() => {
    const urls: Record<string, string> = {}
    for (const img of images) urls[img.id] = imageUrl(img.id, 'thumb')
    return urls
  }, [images])

  const lightbox = useLightbox(images)

  return { images, thumbnailUrls, lightbox }
}
