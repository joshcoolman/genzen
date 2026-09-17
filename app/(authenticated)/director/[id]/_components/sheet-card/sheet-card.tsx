'use client'

import { RefreshCw, Trash2 } from 'lucide-react'
import styles from './sheet-card.module.css'
import type { RefAsset } from '../../../_actions/references.action'
import { CardCaption, ExpandableIconButton, Thumbnail } from '#/components'
import { imageUrl } from '#/lib/image-url'

/**
 * One reference sheet, drawn as an Images card (#690).
 *
 * **Built on `Thumbnail` rather than on `ImageCard`.** The two look the same
 * and want to: the same frame, the same corner actions, the same caption
 * under it, the same badge. But `ImageCard` is Images' own -- groups, select
 * mode, the sweep, drag-to-group, outpaint -- and a tab that has none of those
 * would be importing twenty props to leave nineteen unset. `Thumbnail` and
 * `CardCaption` are the parts that were always shared, so this is thin.
 *
 * **The tile is square and the sheet letterboxes inside it**, exactly as a wide
 * picture does on Images. A 16:9 frame was built first, on the reasoning that
 * every sheet is 16:9 so a square tile wastes a quarter of the grid on
 * pictures whose point is readable detail. Put side by side with the Images
 * wall that was the wrong trade: the letterboxed tile is what the grid looks
 * like, the mat around a contained image is a deliberate part of that look,
 * and a second grid with its own tile shape reads as a different app rather
 * than as more of the same one. Judging the detail is the lightbox's job.
 *
 * What differs from an Images card, and why:
 *
 * - **No hiding.** Hiding earns its place on a wall you keep; this collection
 *   is pruned by deleting until what is left is what is useful, so the corner
 *   is the plain Trash it is on a card with no `onHide`, and Cmd means
 *   nothing.
 * - **New from this is one click, top-left**, where Images puts its `...`
 *   menu. It is the tab's whole reason for existing, and a menu would bury the
 *   primary verb to save an icon the corner already has room for.
 *
 * **The circular arrow is the clip row's Rerun icon, and it means something
 * else here.** There it replaces a burst in place and trashes the take it
 * replaced; this one only ever adds, leaving the sheet it started from
 * untouched. Same glyph, one session, two meanings -- so the hover label is
 * doing the work of telling them apart, and it reads "New from this" rather
 * than anything with "again" or "re-" in it. Worth knowing before the label
 * is ever shortened.
 */
export function SheetCard({
  asset,
  onDerive,
  onDelete,
  onOpen,
}: {
  asset: RefAsset
  onDerive: (asset: RefAsset) => void
  onDelete: (asset: RefAsset) => void
  onOpen: (asset: RefAsset) => void
}) {
  const done = asset.status === 'completed'
  /* `Thumbnail`'s own vocabulary. The row's three states map one to one, so a
     pending sheet is the same tile with the same badge and the same caption in
     the same place -- nothing moves when the picture lands (#367). */
  const status =
    asset.status === 'pending'
      ? 'pending'
      : asset.status === 'failed'
        ? 'failed'
        : 'complete'

  return (
    <Thumbnail
      url={done ? imageUrl(asset.id) : undefined}
      alt={asset.title}
      status={status}
      failedMessage={asset.generation_error ?? undefined}
      objectFit="contain"
      alwaysShowOverlay
      bottomRightBadge={asset.title}
      overlayActionsLeft={
        done ? (
          <ExpandableIconButton
            icon={<RefreshCw className={styles.actionIcon} />}
            label="New from this"
            onClick={() => onDerive(asset)}
          />
        ) : undefined
      }
      overlayActions={
        <ExpandableIconButton
          icon={<Trash2 className={styles.actionIcon} />}
          label="Delete"
          variant="destructive"
          onClick={() => onDelete(asset)}
        />
      }
      onClick={done ? () => onOpen(asset) : undefined}
    >
      {/* The prompt the sheet was drawn from -- the extraction's description of
          the element, or the words typed into New from this. Images' own
          caption component, so the clamp, the copy button and the type cannot
          drift between the two grids. No `onUsePrompt`: there is no generator
          panel here to load it into. */}
      {asset.description && <CardCaption text={asset.description} />}
    </Thumbnail>
  )
}
