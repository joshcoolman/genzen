interface PendingImageCardProps {
  prompt: string
  model: string
  isVariation?: boolean
}

export function PendingImageCard({ prompt, model, isVariation }: PendingImageCardProps) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card">
      {/* Shimmer skeleton */}
      <div className="relative aspect-square bg-muted/50">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent animate-pulse" />
        {isVariation && (
          <span className="absolute top-2 left-2 z-10 bg-background/80 backdrop-blur-sm text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-full">
            Variation
          </span>
        )}

        {/* Loading spinner in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
        </div>
      </div>

      <div className="p-3 space-y-1">
        <p className="text-xs text-muted-foreground/60 font-medium">
          Generating...
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2">{prompt}</p>
        <p className="text-xs text-muted-foreground/60">{model}</p>
      </div>
    </div>
  )
}
