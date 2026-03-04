import { useMemo } from 'react'
import type { FalModel } from '../types'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'

interface RecentlyAddedCarouselProps {
  models: Array<FalModel>
  onModelClick: (model: FalModel) => void
}

export function RecentlyAddedCarousel({
  models,
  onModelClick,
}: RecentlyAddedCarouselProps) {
  const recentModels = useMemo(() => {
    return [...models]
      .filter((m) => m.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 12)
  }, [models])

  if (recentModels.length === 0) return null

  return (
    <div className="space-y-3 overflow-hidden">
      <h2 className="text-sm font-medium text-muted-foreground">
        Recently Added
      </h2>
      <Carousel
        opts={{ align: 'start', dragFree: true, containScroll: 'trimSnaps' }}
        className="w-full"
      >
        <CarouselContent className="-ml-3">
          {recentModels.map((model) => (
            <CarouselItem
              key={model.endpoint_id}
              className="pl-3"
              style={{ flex: '0 0 auto' }}
            >
              <button
                type="button"
                onClick={() => onModelClick(model)}
                className="w-[300px] rounded-lg border bg-card text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="aspect-square w-full overflow-hidden rounded-t-lg bg-muted">
                  {model.thumbnail_url ? (
                    <img
                      src={model.thumbnail_url}
                      alt={model.display_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      No preview
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium">
                    {model.display_name}
                  </p>
                  {model.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {model.description}
                    </p>
                  )}
                </div>
              </button>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="-left-3 hidden sm:flex" />
        <CarouselNext className="-right-3 hidden sm:flex" />
      </Carousel>
    </div>
  )
}
