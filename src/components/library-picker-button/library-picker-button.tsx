'use client'

import { useCallback, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { IconButton } from '../icon-button/icon-button'
import { LibraryPickerDialog } from './library-picker-dialog'

export interface SelectedImage {
  id: string
  url: string
  title: string
}

interface UserImageRow {
  id: string
  title: string
  source: string
  storage_path: string | null
  [key: string]: unknown
}

interface LibraryPickerButtonProps {
  images: Array<UserImageRow>
  imageUrls: Record<string, string>
  originalUrls?: Record<string, string>
  isLoading: boolean
  onSelect: (image: SelectedImage) => void
  onSelectMultiple?: (images: Array<SelectedImage>) => void
  multiple?: boolean
  onOpen?: () => void
  className?: string
}

export function LibraryPickerButton({
  images,
  imageUrls,
  originalUrls,
  isLoading,
  onSelect,
  onSelectMultiple,
  multiple = false,
  onOpen,
  className,
}: LibraryPickerButtonProps) {
  const [open, setOpen] = useState(false)

  const handleOpen = useCallback(() => {
    onOpen?.()
    setOpen(true)
  }, [onOpen])

  return (
    <>
      <IconButton
        className={className}
        onClick={handleOpen}
        aria-label="Open library"
      >
        <BookOpen />
      </IconButton>

      <LibraryPickerDialog
        open={open}
        onOpenChange={setOpen}
        images={images}
        imageUrls={imageUrls}
        originalUrls={originalUrls}
        isLoading={isLoading}
        onSelect={onSelect}
        onSelectMultiple={onSelectMultiple}
        multiple={multiple}
      />
    </>
  )
}
