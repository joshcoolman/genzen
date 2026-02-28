import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import type { DragEndEvent } from '@dnd-kit/core'
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
  onReorder: (draggedId: string, newSortOrder: number) => void
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
  onReorder,
  onOpenLightbox,
  onLoadPrompt,
  onLoadPromptAndModel,
  onMoreLikeThis,
  onEdit,
  onDelete,
}: ImageGalleryProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = images.findIndex((i) => i.id === active.id)
    const newIndex = images.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const withoutDragged = images.filter((_, i) => i !== oldIndex)
    const insertBefore = oldIndex < newIndex ? newIndex : newIndex - 1
    const prev = withoutDragged[insertBefore - 1]?.sort_order
    const next = withoutDragged[insertBefore]?.sort_order

    let newSortOrder: number
    if (prev != null && next != null) {
      newSortOrder = (prev + next) / 2
    } else if (prev != null) {
      newSortOrder = prev - 1
    } else if (next != null) {
      newSortOrder = next + 1
    } else {
      newSortOrder = Date.now() / 1000
    }

    onReorder(active.id as string, newSortOrder)
  }

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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={images.map((i) => i.id)}
            strategy={rectSortingStrategy}
          >
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
                    onLoadPrompt={onLoadPrompt}
                    onLoadPromptAndModel={onLoadPromptAndModel}
                    onMoreLikeThis={onMoreLikeThis}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    getModelName={getModelName}
                  />
                ),
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
