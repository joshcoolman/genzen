import { Thumbnail } from '@/components/Thumbnail'

interface PendingImageCardProps {
  prompt: string
  model: string
  isVariation?: boolean
  sourceImageUrl?: string
  createdAt?: string
  onDelete?: () => void
}

export function PendingImageCard({
  prompt,
  model,
  isVariation,
  sourceImageUrl,
  createdAt,
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
        {prompt}
      </p>
      <div className="border-t border-border px-3 py-2 mt-2 text-xs text-muted-foreground">
        <div className="flex justify-between items-center">
          <span>-</span>
          <span>
            {createdAt
              ? new Date(createdAt).toLocaleDateString()
              : new Date().toLocaleDateString()}
          </span>
        </div>
      </div>
    </Thumbnail>
  )
}
