interface OutpaintPreviewProps {
  sourceImageUrl: string | null
  sourceTitle: string
  aspectRatio: string
}

export function OutpaintPreview({
  sourceImageUrl,
  sourceTitle,
  aspectRatio,
}: OutpaintPreviewProps) {
  const [w, h] = aspectRatio.split(':').map(Number)
  const ratio = w / h

  return (
    <div className="flex w-full justify-center">
      <div
        className="relative w-full max-h-[400px] rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 overflow-hidden"
        style={{ aspectRatio: `${ratio}`, maxWidth: `${400 * ratio}px` }}
      >
        <div className="absolute inset-0 flex items-center justify-center p-2">
          {sourceImageUrl ? (
            <img
              src={sourceImageUrl}
              alt={sourceTitle}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Select an image to preview
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
