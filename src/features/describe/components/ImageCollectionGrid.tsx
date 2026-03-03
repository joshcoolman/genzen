import { X } from 'lucide-react'
import type { CollectedImage } from '../types'
import { ImageCard } from '@/components/ImageCard'
import { ImageGrid } from '@/components/ImageGrid'

interface ImageCollectionGridProps {
  images: Array<CollectedImage>
  onRemove: (id: string) => void
}

export function ImageCollectionGrid({
  images,
  onRemove,
}: ImageCollectionGridProps) {
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-muted-foreground">
        <p className="text-sm">No images collected yet</p>
        <p className="mt-1 text-xs">
          Upload, paste, or select images from your library
        </p>
      </div>
    )
  }

  return (
    <ImageGrid size="md">
      {images.map((image) => (
        <ImageCard
          key={image.id}
          src={image.url}
          alt={image.title}
          onClick={() => {}}
          objectFit="cover"
          compact
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove(image.id)
            }}
            className="absolute top-1 right-1 rounded-full bg-black/70 p-1 text-white hover:bg-black/90"
          >
            <X className="size-3" />
          </button>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6 opacity-0 transition-opacity group-hover:opacity-100">
            <p className="truncate text-xs text-white">{image.title}</p>
          </div>
        </ImageCard>
      ))}
    </ImageGrid>
  )
}
