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
import { computeFileHash } from '../lib/file-hash'
import { uploadImage } from '../server/upload-image.server'
import { removeImages } from '../server/remove-images.server'
import {
  createImageRecord,
  listImages,
  softDeleteImage,
  updateImageMeta,
} from '../server/images.actions'
import type {
  CreateUserImageInput,
  UserImage,
  UserImageFilters,
} from '../types'
import { createImageStorage } from '@/lib/image-storage'

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

export interface OptimisticImage {
  tempId: string
  title: string
  previewUrl: string
}

interface UseUserImagesState {
  images: Array<UserImage>
  imageUrls: Record<string, string>
  originalUrls: Record<string, string>
  optimisticImages: Array<OptimisticImage>
  isLoading: boolean
  isCreating: boolean
  isDeleting: string | null
  isUpdating: string | null
  error: string | null
}

interface CreateOptimisticInput {
  file: File
  title: string
  description?: string | null
  tempId: string
  previewUrl: string
}

interface UseUserImagesReturn extends UseUserImagesState {
  create: (input: CreateUserImageInput) => Promise<UserImage>
  createOptimistic: (input: CreateOptimisticInput) => Promise<void>
  update: (
    id: string,
    title: string,
    description: string | null,
  ) => Promise<UserImage>
  deleteImage: (id: string) => Promise<void>
  refresh: () => Promise<void>
  clearError: () => void
  addOptimisticImage: (
    tempId: string,
    title: string,
    previewUrl: string,
  ) => void
  resolveOptimisticImage: (
    tempId: string,
    realImage: UserImage,
    realUrl: string | null,
  ) => void
  removeOptimisticImage: (tempId: string) => void
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
    optimisticImages: [],
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

      try {
        setState((prev) => ({ ...prev, isCreating: true, error: null }))

        // Generate storage path
        const timestamp = Date.now()
        const uuid = crypto.randomUUID()
        const sanitizedFileName = input.file.name.replace(
          /[^a-zA-Z0-9.-]/g,
          '_',
        )
        const storagePath = `${userId}/${timestamp}_${uuid}_${sanitizedFileName}`

        // Upload file via server function
        const base64Data = await fileToBase64(input.file)
        await uploadImage({
          storagePath,
          base64Data,
          contentType: input.file.type,
        })

        // Create database record
        let newImage: UserImage
        try {
          newImage = await createImageRecord({
            title: input.title,
            description: input.description ?? null,
            storagePath,
            fileName: input.file.name,
            fileSize: input.file.size,
            mimeType: input.file.type,
            fileHash: input.file_hash,
          })
        } catch (insertError) {
          // Rollback: delete the uploaded file, or it is orphaned in storage.
          await removeImages({ storagePaths: [storagePath] }).catch(() => {})
          throw new Error(
            `Failed to create image record: ${(insertError as Error).message}`,
          )
        }

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

  const addOptimisticImage = useCallback(
    (tempId: string, title: string, previewUrl: string) => {
      setState((prev) => ({
        ...prev,
        optimisticImages: [
          { tempId, title, previewUrl },
          ...prev.optimisticImages,
        ],
      }))
    },
    [],
  )

  const resolveOptimisticImage = useCallback(
    (tempId: string, realImage: UserImage, realUrl: string | null) => {
      setState((prev) => ({
        ...prev,
        optimisticImages: prev.optimisticImages.filter(
          (o) => o.tempId !== tempId,
        ),
        images: [realImage, ...prev.images],
        imageUrls: realUrl
          ? { ...prev.imageUrls, [realImage.id]: realUrl }
          : prev.imageUrls,
      }))
    },
    [],
  )

  const removeOptimisticImage = useCallback((tempId: string) => {
    setState((prev) => {
      const opt = prev.optimisticImages.find((o) => o.tempId === tempId)
      if (opt) URL.revokeObjectURL(opt.previewUrl)
      return {
        ...prev,
        optimisticImages: prev.optimisticImages.filter(
          (o) => o.tempId !== tempId,
        ),
      }
    })
  }, [])

  /**
   * Upload with parallel hash computation and seamless optimistic resolution.
   * Hash + storage upload run concurrently; signed URL fetch is skipped
   * (the object URL from the optimistic entry is used for display).
   */
  const createOptimistic = useCallback(
    async (input: CreateOptimisticInput): Promise<void> => {
      if (!userId) throw new Error('User not authenticated')

      const { file, title, description, tempId, previewUrl } = input

      const timestamp = Date.now()
      const uuid = crypto.randomUUID()
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const storagePath = `${userId}/${timestamp}_${uuid}_${sanitizedFileName}`

      // Run server upload and hash computation in parallel
      const base64Data = await fileToBase64(file)
      const [, hashResult] = await Promise.all([
        uploadImage({ storagePath, base64Data, contentType: file.type }),
        computeFileHash(file).catch(() => undefined),
      ])

      // Insert DB record (hash may be undefined if computation failed)
      let newImage: UserImage
      try {
        newImage = await createImageRecord({
          title,
          description: description ?? null,
          storagePath,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          fileHash: hashResult,
        })
      } catch (insertError) {
        await removeImages({ storagePaths: [storagePath] }).catch(() => {})
        throw new Error(
          `Failed to create image record: ${(insertError as Error).message}`,
        )
      }

      // Atomically swap optimistic card for real image, keeping the object URL
      resolveOptimisticImage(tempId, newImage, previewUrl)
    },
    [userId, resolveOptimisticImage],
  )

  return {
    ...state,
    create,
    createOptimistic,
    update,
    deleteImage: deleteImageFn,
    refresh: fetchImages,
    clearError,
    addOptimisticImage,
    resolveOptimisticImage,
    removeOptimisticImage,
  }
}
