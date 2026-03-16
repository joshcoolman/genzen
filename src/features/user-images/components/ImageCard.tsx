import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
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

function DescriptionRow({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    void navigator.clipboard.writeText(description).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="flex items-start gap-1 px-4 pt-1 pb-2">
      <p
        onClick={(e) => {
          e.stopPropagation()
          setExpanded((v) => !v)
        }}
        className={`flex-1 text-[10px] text-muted-foreground cursor-pointer leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}
      >
        {description}
      </p>
      <button
        onClick={handleCopy}
        className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Copy description"
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
    </div>
  )
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
            <div className="flex-1 px-4 pt-3 pb-1">
              <h3 className="text-xs font-medium text-foreground line-clamp-2">
                {image.title}
              </h3>
            </div>
            {image.description ? (
              <DescriptionRow description={image.description} />
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
