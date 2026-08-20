'use client'

import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import styles from './canvas-card.module.css'
import type { CanvasSummary } from '../../_actions/canvases'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ExpandableIconButton,
  Thumbnail,
} from '#/components'
import { imageUrl } from '#/lib/image-url'

/** Five, filling the caption's width. A board with fewer members still draws
 *  five cells -- the empty ones ghost, which keeps the row the same shape on
 *  every card and reads as room for more rather than as a broken grid. */
const SWATCH_COUNT = 5

interface CanvasCardProps {
  canvas: CanvasSummary
  onOpen: (canvas: CanvasSummary) => void
  onRename: (canvas: CanvasSummary) => void
  onDelete: (canvas: CanvasSummary) => void
}

/**
 * A canvas in the index: cover, name, count, and a strip of what is on it.
 *
 * Anatomically a `GroupCard` and deliberately not that component (#446). The
 * shape is worth copying -- it is the one already learned for "a card that
 * stands for several pictures" -- but `GroupCard` takes an `ImageGroupSummary`,
 * carries a members-disclosure toggle and a move-to-group verb, and none of
 * that means anything for a board. Sharing it would mean a prop that turns half
 * of it off.
 *
 * The corner says `Canvas` where an image card names its model, which is the
 * same register: that corner answers "what is this picture", and here the
 * answer is that it stands for a board.
 *
 * Delete is in the menu rather than an overlay icon, and it says what it
 * destroys in the confirm: an arrangement, never a picture.
 */
export function CanvasCard({
  canvas,
  onOpen,
  onRename,
  onDelete,
}: CanvasCardProps) {
  const [coverId, ...rest] = canvas.preview_image_ids
  const coverUrl = coverId ? imageUrl(coverId, 'thumb') : undefined

  const swatchSlots: Array<string | null> = Array.from(
    { length: SWATCH_COUNT },
    (_, i) => rest[i] ?? null,
  )

  const moreButton = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <ExpandableIconButton
            icon={<MoreHorizontal className={styles.menuIcon} />}
            label="Canvas actions"
          />
        }
      />
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => onRename(canvas)}>
          <Pencil />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDelete(canvas)}>
          <Trash2 />
          Delete canvas
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <Thumbnail
      url={coverUrl}
      alt={canvas.name}
      status="complete"
      objectFit="contain"
      alwaysShowOverlay
      fallback={<div className={styles.empty} />}
      imageOverlay={<span className={styles.kind}>Canvas</span>}
      overlayActionsLeft={moreButton}
      onClick={() => onOpen(canvas)}
    >
      <div className={styles.caption}>
        <div className={styles.heading}>
          <span className={styles.name}>{canvas.name}</span>
          <span className={styles.total}>
            {canvas.count} {canvas.count === 1 ? 'image' : 'images'}
          </span>
        </div>
        <div className={styles.swatches}>
          {swatchSlots.map((id, i) => (
            <span
              key={id ?? `empty-${i}`}
              className={id ? styles.swatch : styles.swatchEmpty}
              style={
                id
                  ? { backgroundImage: `url(${imageUrl(id, 'thumb')})` }
                  : undefined
              }
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    </Thumbnail>
  )
}
