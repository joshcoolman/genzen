import type { SavedAiImage } from '@/features/ai-images/types'
import { getModelName } from '@/features/ai-images/models'
import { PendingImageCard } from '@/features/ai-images/components/PendingImageCard'
import { ImageCard } from '@/features/ai-images/components/ImageCard'
import { FailedImageCard } from '@/features/ai-images/components/FailedImageCard'

interface ImageGalleryProps {
  images: Array<SavedAiImage>
  imageUrls: Record<string, string>
  loadingGallery: boolean
  generatingVariationFor: string | null
  onOpenLightbox: (img: SavedAiImage) => void
  onLoadPrompt: (img: SavedAiImage) => void
  onLoadPromptAndModel: (img: SavedAiImage) => void
  onMoreLikeThis: (img: SavedAiImage, count: number) => void
  onEdit: (img: SavedAiImage) => void
  onDelete: (img: SavedAiImage) => void
}

export function ImageGallery({
  images,
  imageUrls,
  loadingGallery,
  generatingVariationFor,
  onOpenLightbox,
  onMoreLikeThis,
  onEdit,
  onDelete,
}: ImageGalleryProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Recent Generations</h2>

      {loadingGallery ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
          <h3 className="mb-2 text-lg font-semibold text-foreground">
            No saved images yet
          </h3>
          <p className="text-sm text-muted-foreground">
            Generate an image to see it here
          </p>
        </div>
      ) : (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          }}
        >
          {images.map((img) =>
            img.status === 'pending' ? (
              <PendingImageCard
                key={img.id}
                prompt={img.generation_metadata?.prompt ?? ''}
                model={getModelName(img.generation_metadata?.model ?? '')}
                isVariation={
                  img.generation_metadata?.generation_type === 'variation'
                }
                sourceImageUrl={
                  img.generation_metadata?.source_image_id
                    ? imageUrls[img.generation_metadata.source_image_id]
                    : undefined
                }
              />
            ) : img.status === 'failed' ? (
              <FailedImageCard key={img.id} img={img} onDelete={onDelete} />
            ) : (
              <ImageCard
                key={img.id}
                img={img}
                imageUrl={imageUrls[img.id]}
                generatingVariation={generatingVariationFor === img.id}
                onOpen={onOpenLightbox}
                onMoreLikeThis={onMoreLikeThis}
                onEdit={onEdit}
                onDelete={onDelete}
                getModelName={getModelName}
              />
            ),
          )}
        </div>
      )}
    </div>
  )
}
