/**
 * Image Upload Button
 *
 * Simple upload button that opens file picker and auto-uploads selected images.
 */

import { useRef, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { computeFileHash } from '../lib/file-hash'
import { parseFilenameToTitle } from '../lib/filename-parser'
import { createUserImageSchema } from '../types'
import type { CreateUserImageInput } from '../types'
import { Button } from '@/components/ui/button'

interface ImageUploadButtonProps {
  onUpload: (input: CreateUserImageInput) => Promise<void>
  isUploading?: boolean
  className?: string
}

/**
 * Upload button component
 *
 * Flow:
 * 1. User clicks button
 * 2. File picker opens
 * 3. User selects file(s)
 * 4. Auto-compute hash
 * 5. Auto-generate title from filename
 * 6. Call onUpload with prepared data
 */
export function ImageUploadButton({
  onUpload,
  isUploading,
  className,
}: ImageUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsProcessing(true)

    try {
      for (const file of Array.from(files)) {
        const file_hash = await computeFileHash(file)
        const title = parseFilenameToTitle(file.name)

        const input: CreateUserImageInput = {
          file,
          file_hash,
          title,
          description: null,
        }

        const validationResult = createUserImageSchema.safeParse(input)
        if (!validationResult.success) {
          console.error('Validation failed:', validationResult.error)
          continue
        }

        await onUpload(input)
      }
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setIsProcessing(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const loading = isUploading || isProcessing

  return (
    <>
      <Button onClick={handleClick} disabled={loading} className={className}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Upload Images
          </>
        )}
      </Button>

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
