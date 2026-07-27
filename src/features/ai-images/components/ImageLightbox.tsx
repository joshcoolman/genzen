import type { LightboxImage } from '#/components/Lightbox'
import type { LightboxItem } from '#/features/ai-images/hooks/use-lightbox'
import { Lightbox } from '#/components/Lightbox'

interface ImageLightboxProps {
  items: Array<LightboxItem>
  imageUrls: Record<string, string>
  currentIndex: number
  onClose: () => void
  onNext: () => void
  onPrev: () => void
  onDelete?: () => void
  onEdit?: () => void
}

export function ImageLightbox({
  items,
  imageUrls,
  currentIndex,
  onClose,
  onNext,
  onPrev,
  onDelete,
  onEdit,
}: ImageLightboxProps) {
  const lightboxImages: Array<LightboxImage> = items.map((item) => ({
    id: item.id,
    url: imageUrls[item.id] ?? '',
    title: item.title,
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
      onEdit={onEdit}
    />
  )
}
