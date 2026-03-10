import { ImageResultCard } from '@/components/ImageResultCard'

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
    <ImageResultCard
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
    </ImageResultCard>
  )
}
