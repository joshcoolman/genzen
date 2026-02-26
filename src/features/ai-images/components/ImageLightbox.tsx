import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { SavedAiImage } from '@/features/ai-images/types'

interface ImageLightboxProps {
  images: Array<SavedAiImage>
  imageUrls: Record<string, string>
  currentIndex: number
  onClose: () => void
  onNext: () => void
  onPrev: () => void
  getModelName: (id: string) => string
}

export function ImageLightbox({
  images,
  imageUrls,
  currentIndex,
  onClose,
  onNext,
  onPrev,
  getModelName,
}: ImageLightboxProps) {
  // Parent only renders this when currentIndex is valid
  const img = images[currentIndex]
  const imageUrl = imageUrls[img.id]

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onNext()
      if (e.key === 'ArrowLeft') onPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, onNext, onPrev])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Prev */}
      {images.length > 1 && (
        <button
          className="absolute left-4 text-white/70 hover:text-white transition-colors p-2"
          onClick={(e) => {
            e.stopPropagation()
            onPrev()
          }}
          aria-label="Previous"
        >
          <ChevronLeft className="h-8 w-8" />
        </button>
      )}

      {/* Image */}
      <div
        className="flex items-center justify-center max-h-[85vh] max-w-[85vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={img.title}
            className="max-h-[85vh] max-w-[85vw] object-contain"
          />
        ) : (
          <div className="w-64 h-64 bg-muted animate-pulse rounded" />
        )}
      </div>

      {/* Next */}
      {images.length > 1 && (
        <button
          className="absolute right-4 text-white/70 hover:text-white transition-colors p-2"
          onClick={(e) => {
            e.stopPropagation()
            onNext()
          }}
          aria-label="Next"
        >
          <ChevronRight className="h-8 w-8" />
        </button>
      )}

      {/* Caption */}
      <div
        className="absolute bottom-0 inset-x-0 px-6 py-4 bg-gradient-to-t from-black/60 to-transparent text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-white/80 line-clamp-2 max-w-2xl mx-auto">
          {img.generation_metadata?.prompt ?? img.title}
        </p>
        <p className="text-xs text-white/50 mt-1">
          {img.generation_metadata
            ? getModelName(img.generation_metadata.model)
            : ''}
          {images.length > 1 && (
            <span className="ml-3">
              {currentIndex + 1} / {images.length}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
