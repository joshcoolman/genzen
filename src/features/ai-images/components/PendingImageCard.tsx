import { Thumbnail } from '@/components/Thumbnail'

interface PendingImageCardProps {
  prompt: string
  model: string
  isVariation?: boolean
  sourceImageUrl?: string
  onDelete?: () => void
}

export function PendingImageCard({
  prompt,
  model,
  isVariation,
  sourceImageUrl,
  onDelete,
}: PendingImageCardProps) {
  return (
    <Thumbnail
      status="pending"
      pendingLabel={model}
      pendingBackgroundUrl={sourceImageUrl}
      topLeftBadge={isVariation ? 'Variation' : undefined}
      onDelete={onDelete}
      alwaysShowOverlay={!!onDelete}
    >
      <p className="truncate px-3 pt-2 text-xs font-medium text-foreground">
        {model}
      </p>
      <p className="px-3 pt-0.5 pb-3 text-xs text-muted-foreground line-clamp-2">
        {prompt}
      </p>
    </Thumbnail>
  )
}
