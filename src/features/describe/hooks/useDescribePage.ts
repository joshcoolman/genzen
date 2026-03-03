import { useCallback, useState } from 'react'
import { processAndUploadFiles } from '../lib/process-files'
import { useImageCollection } from './useImageCollection'
import { useImageUpload } from './useImageUpload'
import { useClipboardPaste } from './useClipboardPaste'
import { useExistingImages } from './useExistingImages'
import type { CreateUserImageInput } from '../types'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

const BUCKET_NAME = 'user-images'

export interface UseDescribePageReturn {
  collection: ReturnType<typeof useImageCollection>
  existingImages: ReturnType<typeof useExistingImages>
  isUploading: boolean
  isPickerOpen: boolean
  setPickerOpen: (open: boolean) => void
  openPicker: () => void
  handleFilesSelected: (files: FileList) => void
  handleRemove: (id: string) => void
}

export function useDescribePage(): UseDescribePageReturn {
  const { user } = useAuth()
  const collection = useImageCollection()
  const { upload, isUploading } = useImageUpload(user?.id)
  const existingImages = useExistingImages(user?.id)
  const [isPickerOpen, setPickerOpen] = useState(false)

  const handleUpload = useCallback(
    async (input: CreateUserImageInput) => {
      const collected = await upload(input)
      collection.add(collected)
    },
    [upload, collection.add],
  )

  useClipboardPaste({ onUpload: handleUpload, enabled: !isPickerOpen })

  const handleFilesSelected = useCallback(
    (files: FileList) => {
      processAndUploadFiles(Array.from(files), handleUpload)
    },
    [handleUpload],
  )

  const openPicker = useCallback(() => {
    existingImages.refresh()
    setPickerOpen(true)
  }, [existingImages.refresh])

  const handleRemove = useCallback(
    (id: string) => {
      const image = collection.images.find((img) => img.id === id)
      if (!image) return

      if (image.addedInSession) {
        // Destructive: delete from Supabase storage + DB, then remove from collection
        supabase
          .from('user_images')
          .select('storage_path')
          .eq('id', id)
          .single()
          .then(({ data }) => {
            if (data?.storage_path) {
              supabase.storage.from(BUCKET_NAME).remove([data.storage_path])
            }
            supabase.from('user_images').delete().eq('id', id)
          })
      }

      collection.remove(id)
    },
    [collection.images, collection.remove],
  )

  return {
    collection,
    existingImages,
    isUploading,
    isPickerOpen,
    setPickerOpen,
    openPicker,
    handleFilesSelected,
    handleRemove,
  }
}
