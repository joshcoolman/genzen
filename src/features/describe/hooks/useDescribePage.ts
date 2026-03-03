import { useCallback, useState } from 'react'
import { processAndUploadFiles } from '../lib/process-files'
import { useImageCollection } from './useImageCollection'
import { useImageUpload } from './useImageUpload'
import { useClipboardPaste } from './useClipboardPaste'
import { useExistingImages } from './useExistingImages'
import type { CreateUserImageInput } from '../types'
import { useAuth } from '@/lib/auth'

export interface UseDescribePageReturn {
  collection: ReturnType<typeof useImageCollection>
  existingImages: ReturnType<typeof useExistingImages>
  isUploading: boolean
  isPickerOpen: boolean
  setPickerOpen: (open: boolean) => void
  openPicker: () => void
  handleFilesSelected: (files: FileList) => void
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

  return {
    collection,
    existingImages,
    isUploading,
    isPickerOpen,
    setPickerOpen,
    openPicker,
    handleFilesSelected,
  }
}
