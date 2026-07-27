import { X } from 'lucide-react'

interface SourceImagePreviewProps {
  src: string
  name: string
  onRemove?: () => void
  variant?: 'compact' | 'square'
}

export function SourceImagePreview({
  src,
  name,
  onRemove,
  variant = 'compact',
}: SourceImagePreviewProps) {
  if (variant === 'square') {
    return (
      <div className="relative aspect-square w-full rounded-lg border border-input bg-black overflow-hidden">
        <img src={src} alt={name} className="h-full w-full object-contain" />
        {onRemove && (
          <button
            onClick={onRemove}
            className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Remove source image"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded border border-input bg-muted/50 px-2.5 py-1.5">
      <img
        src={src}
        alt="Source"
        className="h-10 w-10 rounded object-cover shrink-0"
      />
      <span className="text-xs text-muted-foreground truncate flex-1">
        {name}
      </span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="flex h-6 w-6 items-center justify-center shrink-0 rounded-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Remove source image"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
