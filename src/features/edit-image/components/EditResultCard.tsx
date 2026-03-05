import { Trash2 } from 'lucide-react'
import type { EditResult } from '../types'

interface EditResultCardProps {
  result: EditResult
  onOpen: () => void
  onDelete: () => void
}

export function EditResultCard({
  result,
  onOpen,
  onDelete,
}: EditResultCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card">
      <div className="relative">
        <div
          className="aspect-square w-full bg-black flex items-center justify-center cursor-zoom-in"
          onClick={() => result.url && onOpen()}
        >
          {result.status === 'complete' && result.url ? (
            <img
              src={result.url}
              alt={result.modelName}
              className="w-full h-full object-contain"
            />
          ) : result.status === 'pending' ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-card">
              <div className="size-5 animate-spin rounded-full border-2 border-border border-t-accent-brand" />
              <span className="text-[10px] text-muted-foreground">
                {result.modelName}
              </span>
            </div>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-card">
              <span className="text-xs text-destructive">Failed</span>
              <span className="text-[10px] text-muted-foreground">
                {result.modelName}
              </span>
            </div>
          )}
        </div>

        {/* Model badge */}
        {result.status === 'complete' && (
          <span className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-full">
            {result.modelName}
          </span>
        )}

        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className={`absolute top-1.5 right-1.5 rounded bg-background/80 backdrop-blur-sm p-1 text-muted-foreground hover:text-destructive transition-all ${
            result.status === 'failed'
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100'
          }`}
          aria-label="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Prompt */}
      {result.prompt && (
        <p className="text-xs text-muted-foreground px-3 pb-3 pt-2 line-clamp-2">
          {result.prompt}
        </p>
      )}
    </div>
  )
}
