'use client'

/**
 * useUserImages Hook
 *
 * React hook for managing user images state and operations.
 *
 * Calls the server actions in `../server/images.actions`. It has no database
 * client and names no user: identity comes from the session cookie, server
 * side. There is no RLS behind that -- the explicit `user_id` filter in each
 * action is what keeps one user's rows away from another's.
 */

import { useCallback, useEffect, useState } from 'react'
import { saveFileToLibrary } from '../lib/save-to-library'
import {
  listImages,
  softDeleteImage,
  updateImageMeta,
} from '../server/images.actions'
import type {
  CreateUserImageInput,
  UserImage,
  UserImageFilters,
} from '../types'
import { createImageStorage } from '#/lib/image-storage'

interface UseUserImagesState {
  images: Array<UserImage>
  imageUrls: Record<string, string>
  originalUrls: Record<string, string>
  isLoading: boolean
  isCreating: boolean
  isDeleting: string | null
  isUpdating: string | null
  error: string | null
}

interface UseUserImagesReturn extends UseUserImagesState {
  create: (input: CreateUserImageInput) => Promise<UserImage>
  update: (
    id: string,
    title: string,
    description: string | null,
  ) => Promise<UserImage>
  deleteImage: (id: string) => Promise<void>
  refresh: () => Promise<void>
  clearError: () => void
}

/**
 * Custom hook for managing user images
 */
export function useUserImages(
  userId: string | undefined,
  filters?: UserImageFilters,
): UseUserImagesReturn {
  const [state, setState] = useState<UseUserImagesState>({
    images: [],
    imageUrls: {},
    originalUrls: {},
    isLoading: true,
    isCreating: false,
    isDeleting: null,
    isUpdating: null,
    error: null,
  })

  /**
   * Load signed URLs for images, updating state incrementally so each URL
   * is available as soon as it's ready rather than waiting for all of them.
   */
  const loadImageUrls = useCallback(async (images: Array<UserImage>) => {
    for (const image of images) {
      if (!image.storage_path) continue
      try {
        const thumbnailPath =
          (image as { thumbnail_path?: string | null }).thumbnail_path ??
          image.storage_path
        const storage = createImageStorage()
        const url = await storage.getUrl(thumbnailPath)
        const originalUrl = await storage.getUrl(image.storage_path)
        if (url) {
          setState((prev) => ({
            ...prev,
            imageUrls: { ...prev.imageUrls, [image.id]: url },
            originalUrls: originalUrl
              ? { ...prev.originalUrls, [image.id]: originalUrl }
              : prev.originalUrls,
          }))
        }
      } catch (err) {
        console.error(`Failed to load URL for image ${image.id}:`, err)
      }
    }
  }, [])

  /**
   * Fetch all images
   */
  const fetchImages = useCallback(async () => {
    if (!userId) {
      setState((prev) => ({ ...prev, isLoading: false, images: [] }))
      return
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      const images = await listImages({
        search_term: filters?.search_term,
        limit: filters?.limit,
      })

      setState((prev) => ({
        ...prev,
        images,
        isLoading: false,
      }))

      // Load URLs in background
      if (images.length > 0) {
        loadImageUrls(images)
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load images',
        isLoading: false,
      }))
    }
  }, [userId, filters, loadImageUrls])

  // Load images on mount
  useEffect(() => {
    fetchImages()
  }, [fetchImages])

  /**
   * Create a new image
   */
  const create = useCallback(
    async (input: CreateUserImageInput): Promise<UserImage> => {
      if (!userId) throw new Error('User not authenticated')
      const ownerId = userId

      try {
        setState((prev) => ({ ...prev, isCreating: true, error: null }))

        const newImage = await saveFileToLibrary({
          userId: ownerId,
          file: input.file,
          title: input.title,
          description: input.description ?? null,
          fileHash: input.file_hash,
        })

        // Get URL for new image
        if (!newImage.storage_path) {
          throw new Error('Created image is missing a storage path')
        }

        const newUrl = await createImageStorage().getUrl(newImage.storage_path)

        // Update state
        setState((prev) => ({
          ...prev,
          images: [newImage, ...prev.images],
          imageUrls: newUrl
            ? { ...prev.imageUrls, [newImage.id]: newUrl }
            : prev.imageUrls,
          isCreating: false,
        }))

        return newImage
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to create image',
          isCreating: false,
        }))
        throw err
      }
    },
    [userId],
  )

  /**
   * Update an existing image
   */
  const update = useCallback(
    async (
      id: string,
      title: string,
      description: string | null,
    ): Promise<UserImage> => {
      if (!userId) throw new Error('User not authenticated')

      try {
        setState((prev) => ({ ...prev, isUpdating: id, error: null }))

        // Optimistic update
        setState((prev) => ({
          ...prev,
          images: prev.images.map((img) =>
            img.id === id ? { ...img, title, description } : img,
          ),
        }))

        const updatedImage = await updateImageMeta(id, title, description)

        // Replace with server response
        setState((prev) => ({
          ...prev,
          images: prev.images.map((img) =>
            img.id === updatedImage.id ? updatedImage : img,
          ),
          isUpdating: null,
        }))

        return updatedImage
      } catch (err) {
        // Rollback by refetching
        await fetchImages()
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to update image',
          isUpdating: null,
        }))
        throw err
      }
    },
    [userId, fetchImages],
  )

  /**
   * Delete an image
   */
  const deleteImageFn = useCallback(
    async (id: string): Promise<void> => {
      if (!userId) throw new Error('User not authenticated')

      try {
        setState((prev) => ({ ...prev, isDeleting: id, error: null }))

        // Get storage path first
        const imageToDelete = state.images.find((img) => img.id === id)
        if (!imageToDelete) {
          throw new Error('Image not found')
        }

        // Optimistic delete
        setState((prev) => ({
          ...prev,
          images: prev.images.filter((img) => img.id !== id),
        }))

        // Soft delete — set deleted_at timestamp
        await softDeleteImage(id)

        setState((prev) => ({ ...prev, isDeleting: null }))
      } catch (err) {
        // Rollback by refetching
        await fetchImages()
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to delete image',
          isDeleting: null,
        }))
        throw err
      }
    },
    [userId, state.images, fetchImages],
  )

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  return {
    ...state,
    create,
    update,
    deleteImage: deleteImageFn,
    refresh: fetchImages,
    clearError,
  }
}
