import { useCallback, useState } from 'react'
import type { SelectedImage } from '../types'
import { detectAspectRatio } from '@/features/ai-images/constants'
import { useImageUpload } from '@/features/describe/hooks/useImageUpload'
import { computeFileHash } from '@/features/describe/lib/file-hash'
import { parseFilenameToTitle } from '@/features/describe/lib/filename-parser'

export function useEditSourceImage(userId: string | undefined) {
  const [sourceImage, setSourceImageState] = useState<SelectedImage | null>(
    null,
  )
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const imageUpload = useImageUpload(userId)

  const detectAndSetAspectRatio = useCallback((url: string) => {
    const img = new Image()
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setAspectRatio(detectAspectRatio(img.naturalWidth, img.naturalHeight))
      }
    }
    img.src = url
  }, [])

  const setSourceFromLibrary = useCallback(
    (image: SelectedImage) => {
      setSourceImageState(image)
      detectAndSetAspectRatio(image.url)
    },
    [detectAndSetAspectRatio],
  )

  const setSourceFile = useCallback(
    async (file: File) => {
      const fileHash = await computeFileHash(file)
      const title = parseFilenameToTitle(file.name)
      const result = await imageUpload.upload({
        file,
        title,
        file_hash: fileHash,
      })
      const image: SelectedImage = {
        id: result.id,
        url: result.url,
        title: result.title,
      }
      setSourceImageState(image)
      detectAndSetAspectRatio(image.url)
    },
    [imageUpload, detectAndSetAspectRatio],
  )

  const clearSourceImage = useCallback(() => {
    setSourceImageState(null)
    setAspectRatio('1:1')
  }, [])

  return {
    sourceImage,
    aspectRatio,
    setSourceFromLibrary,
    setSourceFile,
    clearSourceImage,
    isUploading: imageUpload.isUploading,
    uploadError: imageUpload.error,
  }
}
