/**
 * Image Card Component
 *
 * Displays a single image with title, description, and actions.
 */

import { Trash2 } from 'lucide-react'
import type { UserImage } from '../types'

interface ImageCardProps {
  image: UserImage
  imageUrl: string
  onClick: () => void
  onDelete: (id: string) => void
  isDeleting?: boolean
  isUpdating?: boolean
  showInfo?: boolean
  compact?: boolean
}

/**
 * Image card component
 */
export function ImageCard({
  image,
  imageUrl,
  onClick,
  onDelete,
  isDeleting,
  isUpdating,
  showInfo = true,
  compact = false,
}: ImageCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(image.id)
  }

  return (
    <div
      className={`group relative overflow-hidden border border-border bg-card transition-opacity cursor-pointer hover:border-accent-brand/50 flex flex-col ${
        compact ? 'rounded-md' : 'rounded-lg'
      } ${isDeleting ? 'opacity-50' : ''}`}
      onClick={onClick}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-black">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={image.title}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            Loading...
          </div>
        )}

        {/* Delete overlay */}
        <button
          onClick={handleDelete}
          disabled={isDeleting || isUpdating}
          className={`absolute right-1.5 top-1.5 rounded-md bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600 disabled:opacity-50 ${
            compact ? 'p-1' : 'p-1.5'
          }`}
          aria-label="Delete image"
        >
          <Trash2 className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        </button>
      </div>

      {showInfo && !compact && (
        <>
          {/* Content */}
          <div className="flex-1 px-4 pt-3 pb-2">
            <h3 className="text-xs font-medium text-foreground line-clamp-2">
              {image.title}
            </h3>
          </div>

          {/* Metadata - pinned to bottom */}
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            <div className="flex justify-between items-center">
              <span>{formatFileSize(image.file_size)}</span>
              <span>{new Date(image.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
