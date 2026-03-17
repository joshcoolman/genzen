import { useEffect, useState } from 'react'
import { Thumbnail } from '@/components/Thumbnail'

const STALE_THRESHOLD_MS = 2 * 60 * 1000 // 2 minutes

interface PendingImageCardProps {
  prompt: string
  model: string
  isVariation?: boolean
  sourceImageUrl?: string
  createdAt?: string
}

export function PendingImageCard({
  prompt,
  model,
  isVariation,
  sourceImageUrl,
  createdAt,
}: PendingImageCardProps) {
  const [isStale, setIsStale] = useState(() => {
    if (!createdAt) return false
    return Date.now() - new Date(createdAt).getTime() > STALE_THRESHOLD_MS
  })

  useEffect(() => {
    if (!createdAt || isStale) return
    const age = Date.now() - new Date(createdAt).getTime()
    const remaining = STALE_THRESHOLD_MS - age
    if (remaining <= 0) {
      setIsStale(true)
      return
    }
    const timer = setTimeout(() => setIsStale(true), remaining)
    return () => clearTimeout(timer)
  }, [createdAt, isStale])

  return (
    <Thumbnail
      status="pending"
      pendingLabel={model}
      pendingBackgroundUrl={sourceImageUrl}
      topLeftBadge={isVariation ? 'Variation' : undefined}
    >
      <div className="p-3 space-y-1">
        {isStale ? (
          <p className="text-xs text-amber-500 font-medium">Possibly stuck</p>
        ) : (
          <p className="text-xs text-muted-foreground/60 font-medium">
            Generating...
          </p>
        )}
        <p className="text-xs text-muted-foreground line-clamp-2">{prompt}</p>
        <p className="text-xs text-muted-foreground/60">{model}</p>
      </div>
    </Thumbnail>
  )
}
