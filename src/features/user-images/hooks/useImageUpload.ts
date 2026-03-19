import { useCallback, useState } from 'react'
import type { CollectedImage, CreateUserImageInput } from '../types'
import { supabase } from '@/lib/supabase'

const BUCKET_NAME = 'user-images'

interface UseImageUploadReturn {
  upload: (input: CreateUserImageInput) => Promise<CollectedImage>
  isUploading: boolean
  error: string | null
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

        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, input.file, {
            cacheControl: '31536000',
            upsert: false,
          })

        if (uploadError) {
          throw new Error(`Failed to upload file: ${uploadError.message}`)
        }

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
          await supabase.storage.from(BUCKET_NAME).remove([storagePath])
          throw new Error(
            `Failed to create image record: ${insertError.message}`,
          )
        }

        const { data: urlData } = await supabase.storage
          .from(BUCKET_NAME)
          .createSignedUrl(newImage.storage_path, 86400, {
            transform: { width: 400, quality: 80 },
          })

        return {
          id: newImage.id,
          title: newImage.title,
          url: urlData?.signedUrl ?? '',
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
