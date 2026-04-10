import type { FrameStatus } from '../types'

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
      <div
        className="relative group cursor-pointer"
        onClick={onChooseImage}
        role={onChooseImage ? 'button' : undefined}
      >
        <img
          src={imageUrl}
          alt="Frame"
          className="aspect-video w-full rounded-md object-contain border border-border bg-black"
        />
        {onChooseImage && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-md">
            <span className="text-xs text-muted-foreground">Change Image</span>
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
    <div
      className="aspect-video w-full rounded-md border border-dashed border-border bg-muted/30 flex items-center justify-center cursor-pointer hover:border-foreground/30 transition-colors"
      onClick={onChooseImage}
      role={onChooseImage ? 'button' : undefined}
    >
      <p className="text-xs text-muted-foreground">{placeholder}</p>
    </div>
  )
}
