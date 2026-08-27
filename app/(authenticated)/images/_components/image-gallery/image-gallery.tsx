import { useSweepSelect } from '../../_hooks/use-sweep-select'
import { GroupCard } from '../group-card/group-card'
import { PendingImageCard } from '../pending-image-card/pending-image-card'
import { ImageCard } from '../image-card/image-card'
import { FailedImageCard } from '../failed-image-card/failed-image-card'
import styles from './image-gallery.module.css'
import type { SavedAiImage } from '#/features/ai-images/types'
import type { ImageGroupSummary } from '../../_hooks/use-groups'
import { getModelName } from '#/features/ai-images/models'
import { cx } from '#/lib/utils'
import { EmptyState, ImageGridSkeleton } from '#/components'

/* One size. The switcher went in #284 -- large was the only setting ever used,
   and a control nobody touches is worse than no control. */
const GRID_MIN_WIDTH = '200px'

/** What a collapsed strip already shows -- `SWATCH_COUNT` in `GroupCard`. A
 *  group with no more than this is entirely visible, so its strip is not a
 *  toggle. */
const VISIBLE_SWATCHES = 5

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
  /** A card's React key, which is not its id (#353) -- a generation's row
   *  changes id mid-life and must keep the tile it already has. */
  keyFor?: (id: string) => string
  loadingGallery: boolean
  showInfo?: boolean
  /** A true zoom on the grid and nothing else (#284 follow-up). See the note on
   *  the grid element itself. */
  thumbZoom?: number
  onDelete: (img: SavedAiImage) => void
  /** #504. Passed straight through to the card's corner icon. */
  onHide: (img: SavedAiImage) => void
  onRetry?: (img: SavedAiImage) => void
  onDownload?: (img: SavedAiImage) => void
  onAnimate?: (img: SavedAiImage) => void
  onOpen?: (img: SavedAiImage) => void
  /** Cmd/Ctrl-click: the power moves (#284 follow-up). Plain sets the source,
   *  Shift pushes a reference, and on the prompt it loads the text. */
  onAddReference?: (img: SavedAiImage) => void
  onUsePrompt?: (text: string) => void
  onLoad?: (img: SavedAiImage) => void
  /** Per-group count of work in flight (#350) -- generations queued, uploads
   *  still sending. Client-derived, so it costs nothing to keep current. */
  workingByGroup?: Record<string, number>
  /** Which groups have their strip expanded to every member (#352), and the
   *  ids to draw once the read lands. */
  expandedGroupIds?: Set<string>
  groupMembers?: Record<string, Array<string>>
  onToggleGroupMembers?: (groupId: string) => void
  onOpenGroup?: (group: ImageGroupSummary) => void
  onRenameGroup?: (group: ImageGroupSummary) => void
  /** Undefined when there is nowhere to move to -- the card hides the item. */
  onMoveGroup?: (group: ImageGroupSummary) => void
  onDissolveGroup?: (group: ImageGroupSummary) => void
  /** Trash a group from its card. Absent leaves the menu non-destructive. */
  onTrashGroup?: (group: ImageGroupSummary) => void
  onAddToGroup?: (img: SavedAiImage) => void
  onRemoveFromGroup?: (img: SavedAiImage) => void
  onSetGroupCover?: (img: SavedAiImage) => void
  /** Select mode: a click anywhere on a card picks it (#284). */
  selectionActive?: boolean
  isSelected?: (id: string) => boolean
  onSelect?: (id: string, shiftKey: boolean) => void
  /** Shift-drag across the grid (#440): every card the rectangle touches
   *  joins. Additive only -- see `useSweepSelect`. */
  onSweepSelect?: (ids: Array<string>) => void
  /** A click on the grid's own background -- the gaps between cards. Clearing
   *  the selection is what it means (#439); absent when there is none. */
  onBackgroundClick?: () => void
}

export function ImageGallery({
  cells,
  imageUrls,
  loadingGallery,
  showInfo = true,
  thumbZoom = 1,
  onDelete,
  onHide,
  onRetry,
  onDownload,
  onAnimate,
  keyFor,
  onOpen,
  onAddReference,
  onUsePrompt,
  onLoad,
  workingByGroup,
  expandedGroupIds,
  groupMembers,
  onToggleGroupMembers,
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
  onSweepSelect,
  onBackgroundClick,
}: ImageGalleryProps) {
  /* Shift-drag to sweep (#440). Only once select mode is on, which is what
     keeps it from doing anything while you are just looking. Shift-click
     already extends a range from the last card toggled; these agree rather
     than collide -- both mean "add several", one is a click and one is a
     drag. */
  const sweep = useSweepSelect({
    enabled: Boolean(selectionActive && onSweepSelect),
    onSweep: onSweepSelect ?? (() => {}),
  })
  /* The gaps between cards are empty space too, and they belong to the grid
     rather than to the frame around it (#439). Identity again, never a bubbled
     click: everything in this grid is something you can click on purpose. */
  const clearOnBackground = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onBackgroundClick?.()
  }

  return (
    <div className={styles.root} onClick={clearOnBackground}>
      {loadingGallery ? (
        <ImageGridSkeleton />
      ) : cells.length === 0 ? (
        <EmptyState title="No images yet">
          Type a prompt in the panel below and hit Generate to create your first
          image.
        </EmptyState>
      ) : (
        <div
          className={cx(styles.grid, sweep.sweeping && styles.sweeping)}
          onClick={clearOnBackground}
          onPointerDown={sweep.onPointerDown}
          style={{
            // `zoom`, not `transform: scale()`. A transform paints smaller
            // without touching layout, so the grid would keep its old
            // footprint, overflow, and fit no more cards per row -- the one
            // thing this is for. `zoom` participates in layout: px, rem,
            // tokens, caption text and gaps all scale together and `auto-fill`
            // recomputes. It is browser zoom aimed at one subtree, which is
            // exactly what it is copying.
            //
            // It also has to be `zoom` rather than a variable `GRID_MIN_WIDTH`:
            // scaling the column alone leaves the caption at its old size, so
            // the text re-wraps and the card stops being the same card. Nothing
            // in here re-wraps -- only how many fit.
            zoom: thumbZoom,
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
              const expanded = expandedGroupIds?.has(group.id) ?? false
              return (
                <GroupCard
                  key={group.id}
                  group={group}
                  showInfo={showInfo}
                  working={workingByGroup?.[group.id] ?? 0}
                  expanded={expanded}
                  members={expanded ? groupMembers?.[group.id] : undefined}
                  /* Only when there is something the strip is not already
                     showing: a group of five or fewer is entirely visible, so
                     the click would expand to exactly what is there. The cover
                     is not in the strip, hence the minus one. A selection makes
                     the whole card inert. Either way the row falls back to a
                     plain strip rather than a dead control. */
                  onToggleMembers={
                    onToggleGroupMembers &&
                    !selectionActive &&
                    group.count - (group.cover_image_id ? 1 : 0) >
                      VISIBLE_SWATCHES
                      ? () => onToggleGroupMembers(group.id)
                      : undefined
                  }
                  onOpen={onOpenGroup ?? (() => {})}
                  onRename={onRenameGroup ?? (() => {})}
                  onMove={onMoveGroup}
                  onDissolve={onDissolveGroup ?? (() => {})}
                  onTrash={onTrashGroup}
                  selectionActive={selectionActive}
                />
              )
            }

            const img = cell.image
            if (img.status === 'pending') {
              return (
                <PendingImageCard
                  key={keyFor?.(img.id) ?? img.id}
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
                  key={keyFor?.(img.id) ?? img.id}
                  img={img}
                  onDelete={onDelete}
                  onRetry={onRetry}
                />
              )
            }

            return (
              <ImageCard
                key={keyFor?.(img.id) ?? img.id}
                img={img}
                imageUrl={imageUrls[img.id]}
                onHide={onHide}
                objectFit="contain"
                showInfo={showInfo}
                onDelete={onDelete}
                onDownload={onDownload}
                onAnimate={onAnimate}
                onOpen={onOpen}
                onAddReference={onAddReference}
                onUsePrompt={onUsePrompt}
                onLoad={onLoad}
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

      {/* Outside the grid on purpose: the grid carries `zoom`, and a rectangle
          drawn inside it would be scaled along with the cards. Fixed, in
          client coordinates, over everything and taking nothing. */}
      {sweep.rect && (
        <div
          className={styles.marquee}
          style={{
            left: sweep.rect.left,
            top: sweep.rect.top,
            width: sweep.rect.width,
            height: sweep.rect.height,
          }}
        />
      )}
    </div>
  )
}
