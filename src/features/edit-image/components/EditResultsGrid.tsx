import { useState } from 'react'
import { EditResultCard } from './EditResultCard'
import type { EditResult } from '../types'
import type { LightboxImage } from '@/components/Lightbox'
import { Lightbox } from '@/components/Lightbox'

interface EditResultsGridProps {
  results: Array<EditResult>
  onDelete: (id: string) => void
}

export function EditResultsGrid({ results, onDelete }: EditResultsGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (results.length === 0) return null

  const completeResults = results.filter(
    (r) => r.status === 'complete' && r.url,
  )

  const lightboxImages: Array<LightboxImage> = completeResults.map((r) => ({
    id: r.id,
    url: r.url ?? '',
    title: r.modelName,
  }))

  const imageUrls: Record<string, string> = {}
  for (const r of completeResults) {
    if (r.url) imageUrls[r.id] = r.url
  }

  function getCompleteIndex(result: EditResult): number {
    return completeResults.findIndex((r) => r.id === result.id)
  }

  function handleOpen(result: EditResult) {
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
      <h2 className="text-sm font-medium text-muted-foreground">Results</h2>
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
      >
        {results.map((result) => (
          <EditResultCard
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
