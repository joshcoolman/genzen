'use client'

import { Sparkles, Trash2 } from 'lucide-react'
import { REF_RATIO } from '../../refs'
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
 * What differs from an Images card, and why:
 *
 * - **The frame is 16:9, not square.** Every sheet is 16:9 to the last one, so
 *   a square tile letterboxes all of them and spends a quarter of the grid on
 *   nothing -- on exactly the pictures whose point is small detail you have to
 *   be able to read.
 * - **No hiding.** Hiding earns its place on a wall you keep; this collection
 *   is pruned by deleting until what is left is what is useful, so the corner
 *   is the plain Trash it is on a card with no `onHide`, and Cmd means
 *   nothing.
 * - **New from this is one click, top-left**, where Images puts its `...`
 *   menu. It is the tab's whole reason for existing, and a menu would bury the
 *   primary verb to save an icon the corner already has room for.
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
      frameRatio={REF_RATIO.replace(':', ' / ')}
      objectFit="contain"
      alwaysShowOverlay
      bottomRightBadge={asset.title}
      overlayActionsLeft={
        done ? (
          <ExpandableIconButton
            icon={<Sparkles className={styles.actionIcon} />}
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
