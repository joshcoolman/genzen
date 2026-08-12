import { PendingImageCard } from '../pending-image-card/pending-image-card'
import { ImageCard } from '../image-card/image-card'
import { FailedImageCard } from '../failed-image-card/failed-image-card'
import styles from './image-gallery.module.css'
import type { SavedAiImage } from '#/features/ai-images/types'
import { getModelName } from '#/features/ai-images/models'
import { EmptyState, ImageGridSkeleton } from '#/components'

/* One size. The switcher went in #284 -- large was the only setting ever used,
   and a control nobody touches is worse than no control. */
const GRID_MIN_WIDTH = '200px'

interface ImageGalleryProps {
  images: Array<SavedAiImage>
  imageUrls: Record<string, string>
  loadingGallery: boolean
  showInfo?: boolean
  onDelete: (img: SavedAiImage) => void
  onRetry?: (img: SavedAiImage) => void
  onDownload?: (img: SavedAiImage) => void
  onDescribe?: (img: SavedAiImage) => void
  onAnimate?: (img: SavedAiImage) => void
  onGenerateVariations?: (img: SavedAiImage) => void
  onOpen?: (img: SavedAiImage) => void
  /** The Experiment launcher: the grid area becomes one large preview. */
  onExperiment?: (img: SavedAiImage) => void
  /** Cmd/Ctrl-click: the power moves (#284 follow-up). Plain sets the source,
   *  Shift pushes a reference, and on the prompt it loads the text. */
  onAddReference?: (img: SavedAiImage) => void
  onUsePrompt?: (text: string) => void
  /** Select mode: a click anywhere on a card picks it (#284). */
  selectionActive?: boolean
  isSelected?: (id: string) => boolean
  onSelect?: (id: string, shiftKey: boolean) => void
  /** Set when the gallery is scoped to an origin (#207). An empty scope is not
   *  an empty library, and telling someone to write their first prompt when they
   *  have hundreds of images is the wrong sentence. */
  emptyScopeLabel?: string
}

export function ImageGallery({
  images,
  imageUrls,
  loadingGallery,
  showInfo = true,
  onDelete,
  onRetry,
  onDownload,
  onDescribe,
  onAnimate,
  onGenerateVariations,
  onOpen,
  onExperiment,
  onAddReference,
  onUsePrompt,
  selectionActive,
  isSelected,
  onSelect,
  emptyScopeLabel,
}: ImageGalleryProps) {
  return (
    <div className={styles.root}>
      {loadingGallery ? (
        <ImageGridSkeleton />
      ) : images.length === 0 ? (
        <EmptyState
          title={
            emptyScopeLabel ? `Nothing in ${emptyScopeLabel}` : 'No images yet'
          }
        >
          {emptyScopeLabel
            ? 'Nothing matches this filter. Switch to All to see everything.'
            : 'Type a prompt in the panel below and hit Generate to create your first image.'}
        </EmptyState>
      ) : (
        <div
          className={styles.grid}
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${GRID_MIN_WIDTH}, 1fr))`,
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

            return (
              <ImageCard
                key={img.id}
                img={img}
                imageUrl={imageUrls[img.id]}
                objectFit="contain"
                showInfo={showInfo}
                onDelete={onDelete}
                onDownload={onDownload}
                onDescribe={onDescribe}
                onAnimate={onAnimate}
                onGenerateVariations={onGenerateVariations}
                onOpen={onOpen}
                onExperiment={onExperiment}
                onAddReference={onAddReference}
                onUsePrompt={onUsePrompt}
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
