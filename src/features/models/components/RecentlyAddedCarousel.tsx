import { useMemo } from 'react'
import { ModelCard } from './ModelCard'
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
}

export function RecentlyAddedCarousel({ models }: RecentlyAddedCarouselProps) {
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
          {recentModels.map((model, i) => (
            <CarouselItem
              key={model.endpoint_id}
              className="pl-3"
              style={{ flex: '0 0 300px' }}
            >
              <ModelCard model={model} colorIndex={i} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="-left-3 hidden sm:flex" />
        <CarouselNext className="-right-3 hidden sm:flex" />
      </Carousel>
    </div>
  )
}
