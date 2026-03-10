import type { SavedAiImage } from '@/features/ai-images/types'
import { ImageResultCard } from '@/components/ImageResultCard'

interface FailedImageCardProps {
  img: SavedAiImage
  onDelete: (img: SavedAiImage) => void
}

export function FailedImageCard({ img, onDelete }: FailedImageCardProps) {
  return (
    <ImageResultCard
      status="failed"
      failedMessage={img.generation_error ?? 'Unknown error'}
      onDelete={() => onDelete(img)}
    >
      <div className="p-3 space-y-1">
        <p className="text-xs text-muted-foreground line-clamp-2">
          {img.generation_metadata?.prompt ?? img.title}
        </p>
      </div>
    </ImageResultCard>
  )
}
