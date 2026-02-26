import type { SavedAiImage } from '@/features/ai-images/types'

interface FailedImageCardProps {
  img: SavedAiImage
  onDelete: (img: SavedAiImage) => void
}

export function FailedImageCard({ img, onDelete }: FailedImageCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-destructive/50 bg-card">
      <div className="aspect-square flex items-center justify-center bg-destructive/10 p-4">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-destructive">
            Generation Failed
          </p>
          <p className="text-xs text-muted-foreground">
            {img.generation_error ?? 'Unknown error'}
          </p>
        </div>
      </div>
      <div className="p-3 space-y-1">
        <p className="text-xs text-muted-foreground line-clamp-2">
          {img.generation_metadata?.prompt ?? img.title}
        </p>
      </div>
      <button
        onClick={() => onDelete(img)}
        className="absolute top-1.5 right-1.5 rounded bg-background/80 backdrop-blur-sm p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
        aria-label="Delete failed generation"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
      </button>
    </div>
  )
}
