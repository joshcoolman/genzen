'use client'

/**
 * Image Upload Button
 *
 * Upload button that opens file picker, shows optimistic previews immediately,
 * then uploads selected images in parallel in the background.
 */

import { useRef } from 'react'
import { Upload } from 'lucide-react'
import { parseFilenameToTitle } from '../lib/filename-parser'
import { ActionButton } from '#/components/ActionButton'

export interface SelectedFile {
  file: File
  previewUrl: string
  title: string
  tempId: string
}

interface ImageUploadButtonProps {
  onFilesSelected: (files: Array<SelectedFile>) => void
  onUploadOne: (
    tempId: string,
    file: File,
    title: string,
    previewUrl: string,
  ) => Promise<void>
  isUploading?: boolean
  className?: string
}

export function ImageUploadButton({
  onFilesSelected,
  onUploadOne,
  isUploading,
  className,
}: ImageUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)

    // Create optimistic entries immediately
    const selected: Array<SelectedFile> = fileArray.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      title: parseFilenameToTitle(file.name),
      tempId: `upload-${Date.now()}-${crypto.randomUUID()}`,
    }))

    onFilesSelected(selected)

    // Reset input so the same files can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    // Defer upload work so the browser can paint optimistic cards first.
    // All files upload in parallel -- no sequential blocking.
    setTimeout(() => {
      Promise.allSettled(
        selected.map((item) =>
          onUploadOne(item.tempId, item.file, item.title, item.previewUrl),
        ),
      )
    }, 0)
  }

  return (
    <>
      <ActionButton
        onClick={handleClick}
        loading={isUploading}
        loadingText="Uploading..."
        icon={<Upload />}
        className={className}
      >
        Upload Images
      </ActionButton>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  )
}
