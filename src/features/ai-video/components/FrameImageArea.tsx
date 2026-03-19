import type { FrameStatus } from '../types'
import { Button } from '@/components/ui/button'

export function FrameImageArea({
  status,
  imageUrl,
  placeholder,
  generatingLabel = 'Generating...',
  onChooseImage,
}: {
  status: FrameStatus
  imageUrl: string | null
  placeholder: string
  generatingLabel?: string
  onChooseImage?: () => void
}) {
  if (imageUrl && status !== 'generating') {
    return (
      <div className="relative group">
        <img
          src={imageUrl}
          alt="Frame"
          className="aspect-video w-full rounded-md object-contain border border-border bg-black"
        />
        {onChooseImage && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-md">
            <Button variant="outline" size="sm" onClick={onChooseImage}>
              Change Image
            </Button>
          </div>
        )}
      </div>
    )
  }

  if (status === 'generating') {
    return (
      <div className="aspect-video w-full rounded-md border border-border bg-muted/30 flex items-center justify-center animate-pulse">
        <p className="text-xs text-muted-foreground">{generatingLabel}</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="aspect-video w-full rounded-md border border-destructive/50 bg-destructive/10 flex items-center justify-center">
        <p className="text-xs text-destructive">Generation failed</p>
      </div>
    )
  }

  return (
    <div className="aspect-video w-full rounded-md border border-dashed border-border bg-muted/30 flex items-center justify-center">
      {onChooseImage ? (
        <Button variant="outline" size="sm" onClick={onChooseImage}>
          Choose Image
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">{placeholder}</p>
      )}
    </div>
  )
}
