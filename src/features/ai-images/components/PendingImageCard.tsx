import { Thumbnail } from '@/components/Thumbnail'

interface PendingImageCardProps {
  prompt: string
  model: string
  isVariation?: boolean
  sourceImageUrl?: string
}

export function PendingImageCard({
  prompt,
  model,
  isVariation,
  sourceImageUrl,
}: PendingImageCardProps) {
  return (
    <Thumbnail
      status="pending"
      pendingLabel={model}
      pendingBackgroundUrl={sourceImageUrl}
      topLeftBadge={isVariation ? 'Variation' : undefined}
    >
      <div className="p-3 space-y-1">
        <p className="text-xs text-muted-foreground/60 font-medium">
          Generating...
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2">{prompt}</p>
        <p className="text-xs text-muted-foreground/60">{model}</p>
      </div>
    </Thumbnail>
  )
}
