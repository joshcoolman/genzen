import { useCallback, useState } from 'react'
import { createThumbnail } from '../server/create-thumbnail.server'
import { uploadImage } from '../server/upload-image.server'
import { removeImages } from '../server/remove-images.server'
import type { CollectedImage, CreateUserImageInput } from '../types'
import { supabase } from '@/lib/supabase'
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

        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session?.access_token) throw new Error('No active session')

        const base64Data = await fileToBase64(input.file)
        await uploadImage({
          data: {
            accessToken: session.access_token,
            storagePath,
            base64Data,
            contentType: input.file.type,
          },
        })

        const { data: newImage, error: insertError } = await supabase
          .from('user_images')
          .insert({
            user_id: userId,
            title: input.title,
            description: input.description ?? null,
            storage_path: storagePath,
            file_name: input.file.name,
            file_size: input.file.size,
            mime_type: input.file.type,
            file_hash: input.file_hash,
          })
          .select()
          .single()

        if (insertError) {
          await removeImages({
            data: {
              accessToken: session.access_token,
              storagePaths: [storagePath],
            },
          }).catch(() => {})
          throw new Error(
            `Failed to create image record: ${insertError.message}`,
          )
        }

        if (!newImage.storage_path) {
          throw new Error('Created image is missing a storage path')
        }
        const persistedStoragePath = newImage.storage_path

        // Generate thumbnail in background
        createThumbnail({
          data: {
            accessToken: session.access_token,
            imageId: newImage.id,
            storagePath: persistedStoragePath,
          },
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
