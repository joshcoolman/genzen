import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { GenerationResult } from '@/lib/types/generation-result'
import type { LightboxImage } from '@/components/Lightbox'
import { Lightbox } from '@/components/Lightbox'

interface GenerationResultCardProps {
  result: GenerationResult
  onOpen: () => void
  onDelete: () => void
}

function GenerationResultCard({
  result,
  onOpen,
  onDelete,
}: GenerationResultCardProps) {
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
              alt={result.label}
              className="w-full h-full object-contain"
            />
          ) : result.status === 'pending' ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-card">
              <div className="size-5 animate-spin rounded-full border-2 border-border border-t-accent-brand" />
              <span className="text-[10px] text-muted-foreground">
                {result.label}
              </span>
            </div>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-card">
              <span className="text-xs text-destructive">Failed</span>
              <span className="text-[10px] text-muted-foreground">
                {result.label}
              </span>
            </div>
          )}
        </div>

        {result.status === 'complete' && (
          <span className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-full">
            {result.label}
          </span>
        )}

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

      {result.prompt && (
        <p className="text-xs text-muted-foreground px-3 pb-3 pt-2 line-clamp-2">
          {result.prompt}
        </p>
      )}
    </div>
  )
}

interface GenerationResultsGridProps {
  results: Array<GenerationResult>
  onDelete: (id: string) => void
  title?: string
}

export function GenerationResultsGrid({
  results,
  onDelete,
  title = 'Results',
}: GenerationResultsGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (results.length === 0) return null

  const completeResults = results.filter(
    (r) => r.status === 'complete' && r.url,
  )

  const lightboxImages: Array<LightboxImage> = completeResults.map((r) => ({
    id: r.id,
    url: r.url ?? '',
    title: r.label,
  }))

  const imageUrls: Record<string, string> = {}
  for (const r of completeResults) {
    if (r.url) imageUrls[r.id] = r.url
  }

  function getCompleteIndex(result: GenerationResult): number {
    return completeResults.findIndex((r) => r.id === result.id)
  }

  function handleOpen(result: GenerationResult) {
    const idx = getCompleteIndex(result)
    if (idx >= 0) setLightboxIndex(idx)
  }

  function handleLightboxDelete() {
    if (lightboxIndex === null) return
    const toDelete = completeResults[lightboxIndex]
    onDelete(toDelete.id)
    if (completeResults.length <= 1) {
      setLightboxIndex(null)
    } else if (lightboxIndex >= completeResults.length - 1) {
      setLightboxIndex(lightboxIndex - 1)
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
      >
        {results.map((result) => (
          <GenerationResultCard
            key={result.id}
            result={result}
            onOpen={() => handleOpen(result)}
            onDelete={() => onDelete(result.id)}
          />
        ))}
      </div>

      {lightboxIndex !== null && lightboxImages.length > 0 && (
        <Lightbox
          images={lightboxImages}
          imageUrls={imageUrls}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNext={() =>
            setLightboxIndex((i) =>
              i === null ? 0 : (i + 1) % lightboxImages.length,
            )
          }
          onPrev={() =>
            setLightboxIndex((i) =>
              i === null
                ? 0
                : (i - 1 + lightboxImages.length) % lightboxImages.length,
            )
          }
          onDelete={handleLightboxDelete}
        />
      )}
    </div>
  )
}
