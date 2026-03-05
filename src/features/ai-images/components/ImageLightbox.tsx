import type { LightboxImage } from '@/components/Lightbox'
import type { SavedAiImage } from '@/features/ai-images/types'
import { Lightbox } from '@/components/Lightbox'

interface ImageLightboxProps {
  images: Array<SavedAiImage>
  imageUrls: Record<string, string>
  currentIndex: number
  onClose: () => void
  onNext: () => void
  onPrev: () => void
  onDelete?: () => void
}

export function ImageLightbox({
  images,
  imageUrls,
  currentIndex,
  onClose,
  onNext,
  onPrev,
  onDelete,
}: ImageLightboxProps) {
  const lightboxImages: Array<LightboxImage> = images.map((img) => ({
    id: img.id,
    url: imageUrls[img.id] ?? '',
    title: img.title,
  }))

  return (
    <Lightbox
      images={lightboxImages}
      imageUrls={imageUrls}
      currentIndex={currentIndex}
      onClose={onClose}
      onNext={onNext}
      onPrev={onPrev}
      onDelete={onDelete}
    />
  )
}
