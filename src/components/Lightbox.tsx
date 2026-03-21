import { useHotkey } from '@tanstack/react-hotkeys'
import { ChevronLeft, ChevronRight, Pencil, Trash2, X } from 'lucide-react'

export interface LightboxImage {
  id: string
  url: string
  title: string
}

interface LightboxProps {
  images: Array<LightboxImage>
  imageUrls: Record<string, string>
  currentIndex: number
  onClose: () => void
  onNext: () => void
  onPrev: () => void
  onDelete?: () => void
  onEdit?: () => void
}

export function Lightbox({
  images,
  imageUrls,
  currentIndex,
  onClose,
  onNext,
  onPrev,
  onDelete,
  onEdit,
}: LightboxProps) {
  const img = images[currentIndex]
  const imageUrl = imageUrls[img.id]

  useHotkey('Escape', onClose)
  useHotkey('ArrowRight', onNext)
  useHotkey('ArrowLeft', onPrev)
  useHotkey('Delete', () => onDelete?.())
  useHotkey('Backspace', () => onDelete?.())

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

      {/* Image with delete overlay */}
      <div
        className="relative flex items-center justify-center max-h-[85vh] max-w-[85vw]"
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
        {onEdit && (
          <button
            className="absolute bottom-3 left-3 p-2 rounded-full bg-black/50 text-white/60 hover:text-white hover:bg-black/70 transition-colors"
            onClick={onEdit}
            aria-label="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {onDelete && (
          <button
            className="absolute bottom-3 right-3 p-2 rounded-full bg-black/50 text-white/60 hover:text-red-400 hover:bg-black/70 transition-colors"
            onClick={onDelete}
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
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
    </div>
  )
}
