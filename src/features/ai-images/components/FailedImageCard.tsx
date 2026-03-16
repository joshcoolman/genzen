import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import type { SavedAiImage } from '@/features/ai-images/types'
import { ImageResultCard } from '@/components/ImageResultCard'

interface FailedImageCardProps {
  img: SavedAiImage
  onDelete: (img: SavedAiImage) => void
  onRetry?: (img: SavedAiImage) => void
}

export function FailedImageCard({
  img,
  onDelete,
  onRetry,
}: FailedImageCardProps) {
  const [retrying, setRetrying] = useState(false)

  const handleRetry = async () => {
    if (!onRetry || retrying) return
    setRetrying(true)
    try {
      await onRetry(img)
    } finally {
      setRetrying(false)
    }
  }

  return (
    <ImageResultCard
      status="failed"
      failedMessage={img.generation_error ?? 'Unknown error'}
      onDelete={() => onDelete(img)}
      overlayActions={
        onRetry ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              void handleRetry()
            }}
            disabled={retrying}
            className="rounded bg-background/80 backdrop-blur-sm p-1 text-muted-foreground hover:text-foreground transition-all"
            aria-label="Retry"
            title="Retry generation"
          >
            <RotateCcw
              className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`}
            />
          </button>
        ) : undefined
      }
    >
      <div className="p-3 space-y-1">
        <p className="text-xs text-muted-foreground line-clamp-2">
          {img.generation_metadata?.prompt ?? img.title}
        </p>
      </div>
    </ImageResultCard>
  )
}
