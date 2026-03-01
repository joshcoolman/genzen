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
}: ImageCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(image.id)
  }

  return (
    <div
      className={`group relative overflow-hidden rounded-lg border border-border bg-card transition-opacity cursor-pointer hover:border-accent-brand/50 flex flex-col ${
        isDeleting ? 'opacity-50' : ''
      }`}
      onClick={onClick}
    >
      {/* Image */}
      <div className="aspect-square overflow-hidden bg-sidebar-hover">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={image.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            Loading...
          </div>
        )}
      </div>

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
          <div className="flex items-center gap-2">
            <span>{new Date(image.created_at).toLocaleDateString()}</span>
            <button
              onClick={handleDelete}
              disabled={isDeleting || isUpdating}
              className="text-red-500 hover:text-red-400 disabled:opacity-50 transition-colors"
              aria-label="Delete image"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
