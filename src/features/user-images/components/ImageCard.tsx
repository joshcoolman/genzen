import type { UserImage } from '../types'
import { Thumbnail } from '@/components/Thumbnail'
import { ExpandableText } from '@/components/ExpandableText'
import { formatFileSize } from '@/lib/format'

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
    <Thumbnail
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
            <div className="flex-1 px-4 pt-3 pb-1">
              <h3 className="text-xs font-medium text-foreground line-clamp-2">
                {image.title}
              </h3>
            </div>
            {image.description ? (
              <ExpandableText
                text={image.description}
                className="px-4 pt-1 pb-2"
                textClassName="text-[10px] text-muted-foreground leading-relaxed"
              />
            ) : (
              <div className="flex items-start gap-1 px-4 pt-1 pb-2">
                <p className="flex-1 text-[10px] leading-relaxed line-clamp-3">
                  &nbsp;
                  <br />
                  &nbsp;
                  <br />
                  &nbsp;
                </p>
              </div>
            )}
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
