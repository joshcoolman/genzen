import { X } from 'lucide-react'

interface SourceImagePanelProps {
  imageUrl?: string
  emptyText?: string
  aspectRatio?: 'square' | 'video'
  onRemove?: () => void
  onClick?: () => void
}

export function SourceImagePanel({
  imageUrl,
  emptyText = 'Select an image',
  aspectRatio = 'square',
  onRemove,
  onClick,
}: SourceImagePanelProps) {
  const aspectClass = aspectRatio === 'video' ? 'aspect-video' : 'aspect-square'
  const clickable = !!onClick

  return (
    <div
      className={`relative ${aspectClass} w-full rounded-lg border border-border bg-card overflow-hidden flex items-center justify-center ${clickable ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
      onClick={onClick}
    >
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt="Source"
            className="size-full object-contain bg-black"
          />
          {onRemove && (
            <button
              type="button"
              className="absolute top-1.5 right-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground hover:bg-destructive/80"
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </>
      ) : (
        <span className="text-sm text-muted-foreground">{emptyText}</span>
      )}
    </div>
  )
}
