import { useMemo } from 'react'
import type { SavedAiImage } from '@/features/ai-images/types'
import type { EditChildrenMap } from '@/features/ai-images/hooks/use-edit-children'
import { getModelName } from '@/features/ai-images/models'
import { PendingImageCard } from '@/features/ai-images/components/PendingImageCard'
import { ImageCard } from '@/features/ai-images/components/ImageCard'
import { FailedImageCard } from '@/features/ai-images/components/FailedImageCard'
import { ImageGridSkeleton } from '@/components/ImageGrid'

const GRID_MIN_WIDTH: Record<string, string> = {
  lg: '200px',
  md: '120px',
  sm: '80px',
}

interface ImageGalleryProps {
  images: Array<SavedAiImage>
  imageUrls: Record<string, string>
  rootImageMeta: Record<string, { hidden: boolean }>
  editChildrenMap: EditChildrenMap
  loadingGallery: boolean
  thumbSize?: 'lg' | 'md' | 'sm'
  showInfo?: boolean
  onLoadPrompt: (img: SavedAiImage) => void
  onLoadPromptAndModel: (img: SavedAiImage) => void
  onDelete: (img: SavedAiImage) => void
  onRestoreRoot: (rootId: string) => void
  onRetry?: (img: SavedAiImage) => void
  onStartAdopt?: (img: SavedAiImage) => void
  onDownload?: (img: SavedAiImage) => void
  onUngroup?: (img: SavedAiImage) => void
  onDescribe?: (img: SavedAiImage) => void
  onGenerateVariations?: (img: SavedAiImage) => void
  onGallery?: (img: SavedAiImage) => void
  onOpen?: (img: SavedAiImage) => void
  onChildOpen?: (childId: string, parentImg: SavedAiImage) => void
  selectionActive?: boolean
  isSelected?: (id: string) => boolean
  onSelect?: (id: string, shiftKey: boolean) => void
}

export function ImageGallery({
  images,
  imageUrls,
  rootImageMeta,
  editChildrenMap,
  loadingGallery,
  thumbSize = 'lg',
  showInfo = true,
  onDelete,
  onRestoreRoot,
  onRetry,
  onStartAdopt,
  onDownload,
  onUngroup,
  onDescribe,
  onGenerateVariations,
  onGallery,
  onOpen,
  onChildOpen,
  selectionActive,
  isSelected,
  onSelect,
}: ImageGalleryProps) {
  const compact = thumbSize !== 'lg'

  // Collect IDs of images already shown as thumbnails on a parent card
  const childIds = useMemo(
    () =>
      new Set(
        Object.values(editChildrenMap).flatMap((children) =>
          children.map((c) => c.id),
        ),
      ),
    [editChildrenMap],
  )

  return (
    <div className="space-y-4">
      {loadingGallery ? (
        <ImageGridSkeleton />
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
          <h3 className="mb-2 text-lg font-semibold text-foreground">
            No images yet
          </h3>
          <p className="text-sm text-muted-foreground">
            Type a prompt in the panel below and hit Generate to create your
            first image.
          </p>
        </div>
      ) : (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${GRID_MIN_WIDTH[thumbSize]}, 1fr))`,
          }}
        >
          {images.map((img) => {
            // Skip images already shown as thumbnails on a parent card
            if (childIds.has(img.id)) return null

            const rootId =
              img.generation_metadata?.generation_type === 'variation'
                ? (img.generation_metadata.root_image_id ??
                  img.generation_metadata.source_image_id ??
                  '')
                : ''
            const rootMeta = rootId ? rootImageMeta[rootId] : undefined

            if (img.status === 'pending') {
              return (
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
                  createdAt={img.created_at}
                  onDelete={() => onDelete(img)}
                />
              )
            }

            if (img.status === 'failed') {
              return (
                <FailedImageCard
                  key={img.id}
                  img={img}
                  onDelete={onDelete}
                  onRetry={onRetry}
                />
              )
            }

            return (
              <ImageCard
                key={img.id}
                img={img}
                imageUrl={imageUrls[img.id]}
                objectFit="contain"
                compact={compact}
                showInfo={showInfo}
                rootImageUrl={rootId ? imageUrls[rootId] : undefined}
                rootIsHidden={rootMeta?.hidden}
                editChildren={editChildrenMap[img.id]}
                onRestore={rootId ? () => onRestoreRoot(rootId) : undefined}
                onDelete={onDelete}
                onStartAdopt={onStartAdopt}
                onDownload={onDownload}
                onUngroup={onUngroup}
                onDescribe={onDescribe}
                onGenerateVariations={onGenerateVariations}
                onGallery={onGallery}
                onOpen={onOpen}
                onChildOpen={onChildOpen}
                selected={isSelected?.(img.id)}
                selectionActive={selectionActive}
                onSelect={onSelect}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
