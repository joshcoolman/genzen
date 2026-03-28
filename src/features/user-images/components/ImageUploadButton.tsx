/**
 * Image Upload Button
 *
 * Upload button that opens file picker, shows optimistic previews immediately,
 * then uploads selected images sequentially in the background.
 */

import { useRef } from 'react'
import { Upload } from 'lucide-react'
import { computeFileHash } from '../lib/file-hash'
import { parseFilenameToTitle } from '../lib/filename-parser'
import { createUserImageSchema } from '../types'
import type { CreateUserImageInput } from '../types'
import { ActionButton } from '@/components/ActionButton'

export interface SelectedFile {
  file: File
  previewUrl: string
  title: string
  tempId: string
}

interface ImageUploadButtonProps {
  onFilesSelected: (files: Array<SelectedFile>) => void
  onUploadOne: (tempId: string, input: CreateUserImageInput) => Promise<void>
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

    // Defer upload work so the browser can paint optimistic cards first
    setTimeout(async () => {
      for (const item of selected) {
        try {
          const file_hash = await computeFileHash(item.file)
          const input: CreateUserImageInput = {
            file: item.file,
            file_hash,
            title: item.title,
            description: null,
          }

          const validationResult = createUserImageSchema.safeParse(input)
          if (!validationResult.success) {
            console.error('Validation failed:', validationResult.error)
            continue
          }

          await onUploadOne(item.tempId, input)
        } catch (error) {
          console.error('Upload failed:', error)
        }
      }
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
