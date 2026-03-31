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
  loading?: boolean
}

export function ImageCard({
  image,
  imageUrl,
  onClick,
  onDelete,
  isDeleting,
  compact = false,
  loading = false,
}: ImageCardProps) {
  return (
    <Thumbnail
      url={loading ? null : imageUrl || null}
      alt={image.title}
      onClick={loading ? undefined : onClick}
      objectFit="contain"
      compact={compact}
      dimmed={isDeleting}
      onDelete={loading ? undefined : () => onDelete(image.id)}
      footer={
        !compact ? (
          <>
            <div className="flex-1 px-4 pt-3 pb-1">
              <h3 className="text-[10px] font-bold text-foreground line-clamp-2">
                {loading ? '\u00A0' : image.title}
              </h3>
            </div>
            <div className="px-4 pt-1 pb-2" style={{ minHeight: '3.875rem' }}>
              {loading ? (
                <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
                  --
                </p>
              ) : image.description ? (
                <ExpandableText
                  text={image.description}
                  className=""
                  textClassName="text-[10px] text-muted-foreground leading-relaxed"
                />
              ) : null}
            </div>
            <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              <div className="flex justify-between items-center">
                <span>
                  {loading ? '--' : formatFileSize(image.file_size ?? 0)}
                </span>
                <span>
                  {loading
                    ? '--'
                    : new Date(image.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </>
        ) : undefined
      }
    />
  )
}
