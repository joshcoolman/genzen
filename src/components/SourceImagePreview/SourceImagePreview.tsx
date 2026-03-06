import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SourceImagePreviewProps {
  src: string
  name: string
  onRemove: () => void
}

export function SourceImagePreview({
  src,
  name,
  onRemove,
}: SourceImagePreviewProps) {
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
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={onRemove}
        title="Remove source image"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
