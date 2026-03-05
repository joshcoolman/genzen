import { useCallback, useState } from 'react'
import type { SelectedImage } from '../types'
import { detectAspectRatio } from '@/features/ai-images/constants'

export function useEditSourceImage() {
  const [sourceImage, setSourceImageState] = useState<SelectedImage | null>(
    null,
  )
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [pickerOpen, setPickerOpen] = useState(false)

  const setSourceImage = useCallback((image: SelectedImage) => {
    setSourceImageState(image)
    // Detect aspect ratio from image dimensions
    const img = new Image()
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setAspectRatio(detectAspectRatio(img.naturalWidth, img.naturalHeight))
      }
    }
    img.src = image.url
  }, [])

  const clearSourceImage = useCallback(() => {
    setSourceImageState(null)
    setAspectRatio('1:1')
  }, [])

  return {
    sourceImage,
    aspectRatio,
    setSourceImage,
    clearSourceImage,
    pickerOpen,
    setPickerOpen,
  }
}
