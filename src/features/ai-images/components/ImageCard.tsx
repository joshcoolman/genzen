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
import type { SavedAiImage } from '#/features/ai-images/types'
import type { EditChildrenMap } from '#/features/ai-images/hooks/use-edit-children'
import { Thumbnail } from '#/components/Thumbnail'
import { ExpandableText } from '#/components/ExpandableText'
import { ExpandableIconButton } from '#/components/ExpandableIconButton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'

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
      <DropdownMenuTrigger asChild>
        <ExpandableIconButton
          icon={<MoreHorizontal className="h-3.5 w-3.5" />}
          label="More actions"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {onDownload && (
          <DropdownMenuItem onClick={() => onDownload(img)}>
            <Download className="h-4 w-4" />
            Download
          </DropdownMenuItem>
        )}
        {onStartAdopt && (
          <DropdownMenuItem onClick={() => onStartAdopt(img)}>
            <ArrowUpRight className="h-4 w-4" />
            Move
          </DropdownMenuItem>
        )}
        {hasChildren && onUngroup && (
          <DropdownMenuItem onClick={() => onUngroup(img)}>
            <Unlink className="h-4 w-4" />
            Ungroup
          </DropdownMenuItem>
        )}
        {onUnlink &&
          typeof (img.generation_metadata as Record<string, unknown> | null)
            ?.parent_id === 'string' && (
            <DropdownMenuItem onClick={() => onUnlink(img)}>
              <Unlink className="h-4 w-4" />
              Unlink
            </DropdownMenuItem>
          )}
        {onDescribe && (
          <DropdownMenuItem onClick={() => onDescribe(img)}>
            <MessageSquare className="h-4 w-4" />
            Describe
          </DropdownMenuItem>
        )}
        {onGenerateVariations && img.status === 'completed' && (
          <DropdownMenuItem onClick={() => onGenerateVariations(img)}>
            <Layers className="h-4 w-4" />
            Generate Variations
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const rightButtons = onDelete ? (
    <ExpandableIconButton
      icon={<Trash2 className="h-3.5 w-3.5" />}
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
        active && !selectionActive
          ? 'border-primary ring-2 ring-primary shadow-lg shadow-primary/20'
          : 'border-accent-brand ring-1 ring-accent-brand'
      }
      overlayActionsLeft={selectionActive ? undefined : moreButton}
      overlayActions={selectionActive ? undefined : rightButtons}
      overlayActionsBottomLeft={
        onSelect ? (
          <ExpandableIconButton
            icon={
              selected ? (
                <CheckCircle2 className="h-4 w-4 text-accent-brand" />
              ) : (
                <Circle className="h-4 w-4" />
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
            icon={<Maximize2 className="h-3.5 w-3.5" />}
            label="View in lightbox"
            onClick={() => onGallery(img)}
          />
        ) : undefined
      }
      imageOverlay={
        selectionActive && onSelect ? (
          <div
            className="absolute inset-0 z-10 cursor-pointer select-none"
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
            router.push(`/dashboard/edit/${img.id}`)
          }
        }
      }}
    >
      {!compact && (
        <>
          {showInfo && (
            <>
              <p className="truncate px-3 pt-2 text-xs font-medium text-foreground">
                {img.title}
              </p>
              <ExpandableText
                text={
                  img.description ??
                  img.generation_metadata?.prompt ??
                  img.title
                }
                className="px-3 pt-0.5 pb-3"
                textClassName="text-xs text-muted-foreground"
              />
            </>
          )}
          {rootImageUrl && (
            <div className="px-3 pb-3 flex items-center gap-2">
              <img
                src={rootImageUrl}
                className="w-8 h-8 rounded object-cover border border-border"
                alt="Original"
              />
              <span className="text-[10px] text-muted-foreground">
                Original
              </span>
              {rootIsHidden && onRestore && (
                <button
                  onClick={onRestore}
                  className="text-[10px] text-primary hover:underline ml-auto cursor-pointer"
                >
                  Restore
                </button>
              )}
            </div>
          )}
          {editChildren && editChildren.length > 0 && (
            <div className="px-1.5 pb-1.5">
              <div className="flex flex-wrap gap-1">
                {editChildren.map((child) => (
                  <button
                    key={child.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onChildOpen) {
                        onChildOpen(child.id, img)
                      } else {
                        router.push(
                          `/dashboard/edit/${img.id}?sourceId=${child.id}`,
                        )
                      }
                    }}
                    className="w-10 h-10 rounded overflow-hidden border border-border hover:border-foreground/30 transition-colors cursor-pointer"
                  >
                    <img
                      src={child.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Thumbnail>
  )
}
