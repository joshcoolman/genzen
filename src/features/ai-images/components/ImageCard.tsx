import type { SavedAiImage } from '@/features/ai-images/types'

interface ImageCardProps {
  img: SavedAiImage
  imageUrl: string | undefined
  generatingVariation: boolean
  onOpen: (img: SavedAiImage) => void
  onLoadPrompt: (img: SavedAiImage) => void
  onLoadPromptAndModel: (img: SavedAiImage) => void
  onMoreLikeThis: (img: SavedAiImage) => void
  onDelete: (img: SavedAiImage) => void
  getModelName: (id: string) => string
}

export function ImageCard({
  img,
  imageUrl,
  generatingVariation,
  onOpen,
  onLoadPrompt,
  onLoadPromptAndModel,
  onMoreLikeThis,
  onDelete,
  getModelName,
}: ImageCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card">
      <div className="relative">
        <div
          className="aspect-square w-full bg-black flex items-center justify-center cursor-zoom-in"
          onClick={() => imageUrl && onOpen(img)}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={img.title}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full bg-muted animate-pulse" />
          )}
        </div>
        {img.generation_metadata?.generation_type === 'variation' && (
          <span className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-full">
            Variation
          </span>
        )}
        <button
          onClick={() => onDelete(img)}
          className="absolute top-1.5 right-1.5 rounded bg-background/80 backdrop-blur-sm p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
          aria-label="Delete image"
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
        <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onLoadPrompt(img)}
            className="flex-1 rounded bg-background/80 backdrop-blur-sm px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-background/95 transition-colors"
          >
            Prompt
          </button>
          <button
            onClick={() => onLoadPromptAndModel(img)}
            className="flex-1 rounded bg-background/80 backdrop-blur-sm px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-background/95 transition-colors"
          >
            P+M
          </button>
          <button
            onClick={() => onMoreLikeThis(img)}
            disabled={generatingVariation}
            className="flex-1 rounded bg-background/80 backdrop-blur-sm px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-background/95 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingVariation ? '...' : 'More'}
          </button>
        </div>
      </div>
      <div className="p-3 space-y-1">
        <p className="text-xs text-muted-foreground line-clamp-2">
          {img.generation_metadata?.prompt ?? img.title}
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground/60">
          <span>
            {img.generation_metadata
              ? getModelName(img.generation_metadata.model)
              : ''}
          </span>
          <span>{new Date(img.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  )
}
