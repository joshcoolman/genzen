import type { UserImage } from '../types'
import { ImageResultCard } from '@/components/ImageResultCard'

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

export function ImageCard({
  image,
  imageUrl,
  onClick,
  onDelete,
  isDeleting,
  compact = false,
}: ImageCardProps) {
  return (
    <ImageResultCard
      url={imageUrl || null}
      alt={image.title}
      onClick={onClick}
      objectFit="contain"
      compact={compact}
      dimmed={isDeleting}
      onDelete={() => onDelete(image.id)}
      footer={
        !compact ? (
          <>
            <div className="flex-1 px-4 pt-3 pb-2">
              <h3 className="text-xs font-medium text-foreground line-clamp-2">
                {image.title}
              </h3>
            </div>
            <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              <div className="flex justify-between items-center">
                <span>{formatFileSize(image.file_size)}</span>
                <span>{new Date(image.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </>
        ) : undefined
      }
    />
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
