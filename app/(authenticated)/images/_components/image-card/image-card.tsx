'use client'

import {
  CheckCircle2,
  Circle,
  Download,
  Frame,
  Layers,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'
import styles from './image-card.module.css'
import type { SavedAiImage } from '#/features/ai-images/types'
import { cx } from '#/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ExpandableIconButton,
  ExpandableText,
  Thumbnail,
} from '#/components'

interface ImageCardProps {
  img: SavedAiImage
  imageUrl: string | undefined
  objectFit?: 'contain' | 'cover'
  compact?: boolean
  showInfo?: boolean
  onDelete?: (img: SavedAiImage) => void
  onDownload?: (img: SavedAiImage) => void
  onDescribe?: (img: SavedAiImage) => void
  onGenerateVariations?: (img: SavedAiImage) => void
  onGallery?: (img: SavedAiImage) => void
  /** Card click. Nothing happens without it -- clicking used to navigate to
   *  /edit, and that route is gone (#205). */
  onOpen?: (img: SavedAiImage) => void
  selected?: boolean
  selectionActive?: boolean
  onSelect?: (id: string, shiftKey: boolean) => void
  active?: boolean // Highlighted as the next prompt's reference
}

export function ImageCard({
  img,
  imageUrl,
  objectFit,
  compact = false,
  showInfo = true,
  onDelete,
  onDownload,
  onDescribe,
  onGenerateVariations,
  onGallery,
  onOpen,
  selected,
  selectionActive,
  onSelect,
  active,
}: ImageCardProps) {
  const moreButton = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <ExpandableIconButton
            icon={<MoreHorizontal className={styles.menuIcon} />}
            label="More actions"
          />
        }
      />
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {onDownload && (
          <DropdownMenuItem onClick={() => onDownload(img)}>
            <Download className={styles.menuItemIcon} />
            Download
          </DropdownMenuItem>
        )}
        {onDescribe && (
          <DropdownMenuItem onClick={() => onDescribe(img)}>
            <MessageSquare className={styles.menuItemIcon} />
            Describe
          </DropdownMenuItem>
        )}
        {onGenerateVariations && img.status === 'completed' && (
          <DropdownMenuItem onClick={() => onGenerateVariations(img)}>
            <Layers className={styles.menuItemIcon} />
            Generate Variations
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const rightButtons = onDelete ? (
    <ExpandableIconButton
      icon={<Trash2 className={styles.actionIcon} />}
      label="Delete"
      variant="destructive"
      onClick={() => onDelete(img)}
    />
  ) : undefined

  return (
    <Thumbnail
      url={imageUrl}
      alt={img.title}
      status="complete"
      objectFit={objectFit}
      compact={compact}
      alwaysShowOverlay
      selected={selected || (active && !selectionActive)}
      selectedClassName={
        active && !selectionActive ? styles.activeTile : styles.selectedTile
      }
      overlayActionsLeft={selectionActive ? undefined : moreButton}
      overlayActions={selectionActive ? undefined : rightButtons}
      overlayActionsBottomLeft={
        onSelect ? (
          <ExpandableIconButton
            icon={
              selected ? (
                <CheckCircle2
                  className={cx(styles.selectIcon, styles.selectIconOn)}
                />
              ) : (
                <Circle className={styles.selectIcon} />
              )
            }
            label={selected ? 'Deselect' : 'Select'}
            onClick={(e) => onSelect(img.id, e.shiftKey)}
          />
        ) : undefined
      }
      overlayActionsBottomRight={
        onGallery && !selectionActive ? (
          <ExpandableIconButton
            icon={<Maximize2 className={styles.actionIcon} />}
            label="View in lightbox"
            onClick={() => onGallery(img)}
          />
        ) : undefined
      }
      imageOverlay={
        <>
          {/* Passive, and that is the whole point (#216): trashing an image
              that is arranged on the canvas takes it off a surface you are not
              looking at. Saying so on the card prevents the surprise instead of
              interrupting to explain it. Bottom-centre because all four corners
              are permanently occupied -- this card pins its overlay. */}
          {img.on_canvas && (
            <span className={styles.onCanvas}>
              <Frame className={styles.onCanvasIcon} aria-hidden="true" />
              On canvas
            </span>
          )}
          {selectionActive && onSelect && (
            <div
              className={styles.selectOverlay}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(img.id, e.shiftKey)
              }}
            />
          )}
        </>
      }
      onClick={() => {
        if (!selectionActive) onOpen?.(img)
      }}
    >
      {!compact && (
        <>
          {showInfo && (
            <>
              <p className={styles.title}>{img.title}</p>
              <ExpandableText
                text={
                  img.description ??
                  img.generation_metadata?.prompt ??
                  img.title
                }
              />
            </>
          )}
        </>
      )}
    </Thumbnail>
  )
}
