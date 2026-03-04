import { useMemo, useState } from 'react'
import { ModelCard } from './ModelCard'
import type { FalModel } from '../types'

interface RecentlyAddedProps {
  models: Array<FalModel>
}

const INITIAL_COUNT = 4

export function RecentlyAddedCarousel({ models }: RecentlyAddedProps) {
  const [expanded, setExpanded] = useState(false)

  const recentModels = useMemo(() => {
    return [...models]
      .filter((m) => m.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 12)
  }, [models])

  if (recentModels.length === 0) return null

  const visible = expanded ? recentModels : recentModels.slice(0, INITIAL_COUNT)
  const hasMore = recentModels.length > INITIAL_COUNT

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          Recently Added
        </h2>
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? 'Show less' : `Show all (${recentModels.length})`}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((model) => (
          <ModelCard key={model.endpoint_id} model={model} colorIndex={0} />
        ))}
      </div>
    </div>
  )
}
