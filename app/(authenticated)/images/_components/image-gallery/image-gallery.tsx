import { GroupCard } from '../group-card/group-card'
import { PendingImageCard } from '../pending-image-card/pending-image-card'
import { ImageCard } from '../image-card/image-card'
import { FailedImageCard } from '../failed-image-card/failed-image-card'
import styles from './image-gallery.module.css'
import type { SavedAiImage } from '#/features/ai-images/types'
import type { ImageGroupSummary } from '../../_hooks/use-groups'
import { getModelName } from '#/features/ai-images/models'
import { EmptyState, ImageGridSkeleton } from '#/components'

/* One size. The switcher went in #284 -- large was the only setting ever used,
   and a control nobody touches is worse than no control. */
const GRID_MIN_WIDTH = '200px'

/**
 * One cell of the grid: a loose image, or a group standing in for its members.
 *
 * A union rather than two lists, because they are ordered against each other
 * (#324). A group's position is its newest member's, so an active group sits
 * among today's pictures and a finished one sinks past them -- which only works
 * if there is one sequence. Rendering groups as their own block meant a group
 * outranked every image in the library no matter how old it was.
 *
 * `use-view` builds this; the sort key lives there with the rest of the
 * ordering, so the ascending toggle reverses one list rather than two.
 */
export type GalleryCell =
  | { kind: 'group'; group: ImageGroupSummary }
  | { kind: 'image'; image: SavedAiImage }

interface ImageGalleryProps {
  cells: Array<GalleryCell>
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
  /** Per-group count of work in flight (#350) -- generations queued, uploads
   *  still sending. Client-derived, so it costs nothing to keep current. */
  workingByGroup?: Record<string, number>
  onOpenGroup?: (group: ImageGroupSummary) => void
  onRenameGroup?: (group: ImageGroupSummary) => void
  /** Undefined when there is nowhere to move to -- the card hides the item. */
  onMoveGroup?: (group: ImageGroupSummary) => void
  onDissolveGroup?: (group: ImageGroupSummary) => void
  onTrashGroup?: (group: ImageGroupSummary) => void
  onAddToGroup?: (img: SavedAiImage) => void
  onRemoveFromGroup?: (img: SavedAiImage) => void
  onSetGroupCover?: (img: SavedAiImage) => void
  /** Select mode: a click anywhere on a card picks it (#284). */
  selectionActive?: boolean
  isSelected?: (id: string) => boolean
  onSelect?: (id: string, shiftKey: boolean) => void
}

export function ImageGallery({
  cells,
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
  workingByGroup,
  onOpenGroup,
  onRenameGroup,
  onMoveGroup,
  onDissolveGroup,
  onTrashGroup,
  onAddToGroup,
  onRemoveFromGroup,
  onSetGroupCover,
  selectionActive,
  isSelected,
  onSelect,
}: ImageGalleryProps) {
  return (
    <div className={styles.root}>
      {loadingGallery ? (
        <ImageGridSkeleton />
      ) : cells.length === 0 ? (
        <EmptyState title="No images yet">
          Type a prompt in the panel below and hit Generate to create your first
          image.
        </EmptyState>
      ) : (
        <div
          className={styles.grid}
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${GRID_MIN_WIDTH}, 1fr))`,
          }}
        >
          {/* One sequence, groups and images ordered against each other -- a
              group is a lens on the same library, not a second place, which is
              why there is no separate section, no sidebar list, and since #324
              no block of its own. A group sits where its newest member would. */}
          {cells.map((cell) => {
            if (cell.kind === 'group') {
              const { group } = cell
              return (
                <GroupCard
                  key={group.id}
                  group={group}
                  showInfo={showInfo}
                  working={workingByGroup?.[group.id] ?? 0}
                  onOpen={onOpenGroup ?? (() => {})}
                  onRename={onRenameGroup ?? (() => {})}
                  onMove={onMoveGroup}
                  onDissolve={onDissolveGroup ?? (() => {})}
                  onTrash={onTrashGroup ?? (() => {})}
                  selectionActive={selectionActive}
                />
              )
            }

            const img = cell.image
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
                onAddToGroup={onAddToGroup}
                onRemoveFromGroup={onRemoveFromGroup}
                onSetGroupCover={onSetGroupCover}
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
