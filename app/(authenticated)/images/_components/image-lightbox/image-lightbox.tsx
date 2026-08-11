import { Lightbox } from '../lightbox/lightbox'
import type { LightboxItem } from '../../_hooks/use-lightbox'

interface ImageLightboxProps {
  items: Array<LightboxItem>
  imageUrls: Record<string, string>
  thumbnailUrls: Record<string, string>
  currentIndex: number
  onClose: () => void
  onSelect: (index: number) => void
  onNext: () => void
  onPrev: () => void
  onDelete?: () => void
}

export function ImageLightbox({
  items,
  imageUrls,
  thumbnailUrls,
  currentIndex,
  onClose,
  onSelect,
  onNext,
  onPrev,
  onDelete,
}: ImageLightboxProps) {
  return (
    <Lightbox
      images={items}
      imageUrls={imageUrls}
      thumbnailUrls={thumbnailUrls}
      currentIndex={currentIndex}
      onClose={onClose}
      onSelect={onSelect}
      onNext={onNext}
      onPrev={onPrev}
      onDelete={onDelete}
    />
  )
}
