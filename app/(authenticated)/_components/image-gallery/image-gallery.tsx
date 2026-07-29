import { PendingImageCard } from '../pending-image-card/pending-image-card'
import { ImageCard } from '../image-card/image-card'
import { FailedImageCard } from '../failed-image-card/failed-image-card'
import styles from './image-gallery.module.css'
import type { SavedAiImage } from '#/features/ai-images/types'
import { getModelName } from '#/features/ai-images/models'
import { EmptyState, ImageGridSkeleton } from '#/components'

const GRID_MIN_WIDTH: Record<string, string> = {
  lg: '200px',
  md: '120px',
  sm: '80px',
}

interface ImageGalleryProps {
  images: Array<SavedAiImage>
  imageUrls: Record<string, string>
  loadingGallery: boolean
  thumbSize?: 'lg' | 'md' | 'sm'
  showInfo?: boolean
  onLoadPrompt?: (img: SavedAiImage) => void
  onLoadPromptAndModel?: (img: SavedAiImage) => void
  onDelete: (img: SavedAiImage) => void
  onRetry?: (img: SavedAiImage) => void
  onDownload?: (img: SavedAiImage) => void
  onDescribe?: (img: SavedAiImage) => void
  onGenerateVariations?: (img: SavedAiImage) => void
  onGallery?: (img: SavedAiImage) => void
  onOpen?: (img: SavedAiImage) => void
  selectionActive?: boolean
  isSelected?: (id: string) => boolean
  onSelect?: (id: string, shiftKey: boolean) => void
  activeId?: string // Highlight active source in edit view
  parentId?: string // Parent image ID — no delete/select in edit view
}

export function ImageGallery({
  images,
  imageUrls,
  loadingGallery,
  thumbSize = 'lg',
  showInfo = true,
  onDelete,
  onRetry,
  onDownload,
  onDescribe,
  onGenerateVariations,
  onGallery,
  onOpen,
  selectionActive,
  isSelected,
  onSelect,
  activeId,
  parentId,
}: ImageGalleryProps) {
  const compact = thumbSize !== 'lg'

  return (
    <div className={styles.root}>
      {loadingGallery ? (
        <ImageGridSkeleton />
      ) : images.length === 0 ? (
        <EmptyState title="No images yet">
          Type a prompt in the panel below and hit Generate to create your first
          image.
        </EmptyState>
      ) : (
        <div
          className={styles.grid}
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${GRID_MIN_WIDTH[thumbSize]}, 1fr))`,
          }}
        >
          {images.map((img) => {
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

            const isParent = parentId === img.id

            return (
              <ImageCard
                key={img.id}
                img={img}
                imageUrl={imageUrls[img.id]}
                objectFit="contain"
                compact={compact}
                showInfo={showInfo}
                onDelete={isParent ? undefined : onDelete}
                onDownload={onDownload}
                onDescribe={onDescribe}
                onGenerateVariations={onGenerateVariations}
                onGallery={onGallery}
                onOpen={onOpen}
                selected={isParent ? undefined : isSelected?.(img.id)}
                selectionActive={isParent ? false : selectionActive}
                onSelect={isParent ? undefined : onSelect}
                active={activeId === img.id}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
