import type { EditResult } from '../types'
import { ImageCard } from '@/components/ImageCard'
import { ImageGrid } from '@/components/ImageGrid'

interface EditResultsGridProps {
  results: Array<EditResult>
}

export function EditResultsGrid({ results }: EditResultsGridProps) {
  if (results.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">Results</h2>
      <ImageGrid size="md">
        {results.map((result) => (
          <ImageCard
            key={result.id}
            src={result.url ?? null}
            alt={result.modelName}
            onClick={() => {}}
            compact
            fallback={
              result.status === 'pending' ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-card">
                  <div className="size-5 animate-spin rounded-full border-2 border-border border-t-accent-brand" />
                  <span className="text-[10px] text-muted-foreground">
                    {result.modelName}
                  </span>
                </div>
              ) : result.status === 'failed' ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-card">
                  <span className="text-xs text-destructive">Failed</span>
                  <span className="text-[10px] text-muted-foreground">
                    {result.modelName}
                  </span>
                </div>
              ) : undefined
            }
            footer={
              result.status === 'complete' ? (
                <div className="px-2 py-1">
                  <span className="truncate text-[10px] text-muted-foreground">
                    {result.modelName}
                  </span>
                </div>
              ) : undefined
            }
          />
        ))}
      </ImageGrid>
    </div>
  )
}
