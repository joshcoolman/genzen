import { Search } from 'lucide-react'
import { useModels } from '../hooks/use-models'
import { CategoryTabs } from './CategoryTabs'
import { ModelCard } from './ModelCard'
import { ModelDetailSheet } from './ModelDetailSheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function ModelsPage() {
  const m = useModels()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Models</h1>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CategoryTabs value={m.category} onChange={m.setCategory} />
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search models..."
            value={m.search}
            onChange={(e) => m.setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {m.loading ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border p-3"
            >
              <Skeleton className="h-12 w-12 shrink-0 rounded-md" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : m.models.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground">No models found</p>
          {m.search && (
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different search term
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {m.models.map((model) => (
              <ModelCard
                key={model.endpoint_id}
                model={model}
                onClick={() => m.openDetail(model)}
              />
            ))}
          </div>

          {m.hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={m.loadMore}
                disabled={m.loadingMore}
              >
                {m.loadingMore ? 'Loading...' : 'Load more'}
              </Button>
            </div>
          )}
        </>
      )}

      <ModelDetailSheet
        model={m.selectedModel}
        pricing={m.pricing}
        pricingLoading={m.pricingLoading}
        onClose={m.closeDetail}
      />
    </div>
  )
}
