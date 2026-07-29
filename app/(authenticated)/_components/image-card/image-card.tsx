'use client'

import { useRouter } from 'next/navigation'
import {
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Download,
  Layers,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  Trash2,
  Unlink,
} from 'lucide-react'
import styles from './image-card.module.css'
import type { SavedAiImage } from '#/features/ai-images/types'
import type { EditChildrenMap } from '#/features/ai-images/hooks/use-edit-children'
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
  rootImageUrl?: string
  rootIsHidden?: boolean
  editChildren?: EditChildrenMap[string]
  compact?: boolean
  showInfo?: boolean
  onRestore?: () => void
  onDelete?: (img: SavedAiImage) => void
  onStartAdopt?: (img: SavedAiImage) => void
  onDownload?: (img: SavedAiImage) => void
  onUngroup?: (img: SavedAiImage) => void
  onUnlink?: (img: SavedAiImage) => void
  onDescribe?: (img: SavedAiImage) => void
  onGenerateVariations?: (img: SavedAiImage) => void
  onGallery?: (img: SavedAiImage) => void
  /** Override default navigate-to-edit behavior on card click */
  onOpen?: (img: SavedAiImage) => void
  /** Override default navigate-to-edit behavior on child thumbnail click */
  onChildOpen?: (childId: string, parentImg: SavedAiImage) => void
  selected?: boolean
  selectionActive?: boolean
  onSelect?: (id: string, shiftKey: boolean) => void
  active?: boolean // Active source in edit view
}

export function ImageCard({
  img,
  imageUrl,
  objectFit,
  rootImageUrl,
  rootIsHidden,
  editChildren,
  compact = false,
  showInfo = true,
  onRestore,
  onDelete,
  onStartAdopt,
  onDownload,
  onUngroup,
  onUnlink,
  onDescribe,
  onGenerateVariations,
  onGallery,
  onOpen,
  onChildOpen,
  selected,
  selectionActive,
  onSelect,
  active,
}: ImageCardProps) {
  const router = useRouter()

  const hasChildren = (editChildren?.length ?? 0) > 0

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
        {onStartAdopt && (
          <DropdownMenuItem onClick={() => onStartAdopt(img)}>
            <ArrowUpRight className={styles.menuItemIcon} />
            Move
          </DropdownMenuItem>
        )}
        {hasChildren && onUngroup && (
          <DropdownMenuItem onClick={() => onUngroup(img)}>
            <Unlink className={styles.menuItemIcon} />
            Ungroup
          </DropdownMenuItem>
        )}
        {onUnlink &&
          typeof (img.generation_metadata as Record<string, unknown> | null)
            ?.parent_id === 'string' && (
            <DropdownMenuItem onClick={() => onUnlink(img)}>
              <Unlink className={styles.menuItemIcon} />
              Unlink
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
        selectionActive && onSelect ? (
          <div
            className={styles.selectOverlay}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(img.id, e.shiftKey)
            }}
          />
        ) : undefined
      }
      onClick={() => {
        if (!selectionActive) {
          if (onOpen) {
            onOpen(img)
          } else {
            router.push(`/edit/${img.id}`)
          }
        }
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
          {rootImageUrl && (
            <div className={styles.original}>
              <img
                src={rootImageUrl}
                className={styles.originalThumb}
                alt="Original"
              />
              <span className={styles.originalLabel}>Original</span>
              {rootIsHidden && onRestore && (
                <button onClick={onRestore} className={styles.restore}>
                  Restore
                </button>
              )}
            </div>
          )}
          {editChildren && editChildren.length > 0 && (
            <div className={styles.children}>
              {editChildren.map((child) => (
                <button
                  key={child.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (onChildOpen) {
                      onChildOpen(child.id, img)
                    } else {
                      router.push(`/edit/${img.id}?sourceId=${child.id}`)
                    }
                  }}
                  className={styles.child}
                >
                  <img src={child.url} alt="" className={styles.childImage} />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </Thumbnail>
  )
}
