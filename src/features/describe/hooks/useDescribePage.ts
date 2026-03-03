import { useCallback, useEffect, useRef, useState } from 'react'
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

  // Validate collection against Supabase on mount -- prune stale references
  const hasValidated = useRef(false)
  useEffect(() => {
    if (hasValidated.current || collection.count === 0) return
    hasValidated.current = true
    const ids = collection.images.map((img) => img.id)
    void (async () => {
      const { data } = await supabase
        .from('user_images')
        .select('id')
        .in('id', ids)
      if (data) {
        const validIds = new Set(data.map((row) => row.id))
        collection.retainOnly(validIds)
      }
    })()
  }, [collection])

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

      collection.remove(id)

      if (image.addedInSession) {
        void (async () => {
          const { data } = await supabase
            .from('user_images')
            .select('storage_path')
            .eq('id', id)
            .single()
          if (data?.storage_path) {
            await supabase.storage.from(BUCKET_NAME).remove([data.storage_path])
          }
          await supabase.from('user_images').delete().eq('id', id)
        })()
      }
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
