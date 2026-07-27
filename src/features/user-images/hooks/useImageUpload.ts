'use client'

import { useCallback, useState } from 'react'
import { createThumbnail } from '../server/create-thumbnail.server'
import { uploadImage } from '../server/upload-image.server'
import { removeImages } from '../server/remove-images.server'
import { createImageRecord } from '../server/images.actions'
import type { CollectedImage, CreateUserImageInput, UserImage } from '../types'
import { createImageStorage } from '@/lib/image-storage'

interface UseImageUploadReturn {
  upload: (input: CreateUserImageInput) => Promise<CollectedImage>
  isUploading: boolean
  error: string | null
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

export function useImageUpload(
  userId: string | undefined,
): UseImageUploadReturn {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = useCallback(
    async (input: CreateUserImageInput): Promise<CollectedImage> => {
      if (!userId) throw new Error('User not authenticated')

      try {
        setIsUploading(true)
        setError(null)

        const timestamp = Date.now()
        const uuid = crypto.randomUUID()
        const sanitizedFileName = input.file.name.replace(
          /[^a-zA-Z0-9.-]/g,
          '_',
        )
        const storagePath = `${userId}/${timestamp}_${uuid}_${sanitizedFileName}`

        const base64Data = await fileToBase64(input.file)
        await uploadImage({
          storagePath,
          base64Data,
          contentType: input.file.type,
        })

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
          await removeImages({ storagePaths: [storagePath] }).catch(() => {})
          throw new Error(
            `Failed to create image record: ${(insertError as Error).message}`,
          )
        }

        if (!newImage.storage_path) {
          throw new Error('Created image is missing a storage path')
        }
        const persistedStoragePath = newImage.storage_path

        // Generate thumbnail in background
        createThumbnail({
          imageId: newImage.id,
          storagePath: persistedStoragePath,
        }).catch(() => {})

        const url = await createImageStorage().getUrl(persistedStoragePath)

        return {
          id: newImage.id,
          title: newImage.title,
          url: url ?? '',
          source: newImage.source,
          addedInSession: true,
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to upload image'
        setError(message)
        throw err
      } finally {
        setIsUploading(false)
      }
    },
    [userId],
  )

  return { upload, isUploading, error }
}
