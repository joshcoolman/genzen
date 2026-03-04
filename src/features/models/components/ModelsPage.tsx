import { useMemo } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { useModels } from '../hooks/use-models'
import { CategoryTabs } from './CategoryTabs'
import { ModelCard } from './ModelCard'
import { RecentlyAddedCarousel } from './RecentlyAddedCarousel'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

export function ModelsPage() {
  const m = useModels()
  const totalModels = m.pages.reduce((sum, page) => sum + page.length, 0)
  const allModels = useMemo(() => m.pages.flat(), [m.pages])
  const showCarousel =
    !m.loading && m.category === 'all' && !m.search && allModels.length > 0

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Models</h1>
        {m.pages.length > 1 && (
          <button
            type="button"
            onClick={m.reload}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload
          </button>
        )}
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

      {showCarousel && <RecentlyAddedCarousel models={allModels} />}

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
      ) : totalModels === 0 ? (
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
          {m.pages.map((page, pageIndex) => {
            if (page.length === 0) return null

            return (
              <div key={pageIndex}>
                {pageIndex > 0 && (
                  <div className="flex items-center gap-3 py-2">
                    <Separator className="flex-1" />
                    <span className="shrink-0 text-xs text-muted-foreground">
                      Page {pageIndex + 1}
                    </span>
                    <Separator className="flex-1" />
                  </div>
                )}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {page.map((model) => (
                    <ModelCard key={model.endpoint_id} model={model} />
                  ))}
                </div>
              </div>
            )
          })}

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
    </div>
  )
}
