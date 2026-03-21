import { useNavigate } from '@tanstack/react-router'
import {
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Download,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  Trash2,
  Unlink,
} from 'lucide-react'
import type { SavedAiImage } from '@/features/ai-images/types'
import type { EditChildrenMap } from '@/features/ai-images/hooks/use-edit-children'
import { Thumbnail } from '@/components/Thumbnail'
import { ExpandableText } from '@/components/ExpandableText'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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
  onDelete: (img: SavedAiImage) => void
  onStartAdopt?: (img: SavedAiImage) => void
  onDownload?: (img: SavedAiImage) => void
  onUngroup?: (img: SavedAiImage) => void
  onDescribe?: (img: SavedAiImage) => void
  onGallery?: (img: SavedAiImage) => void
  selected?: boolean
  selectionActive?: boolean
  onSelect?: (id: string, shiftKey: boolean) => void
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
  onDescribe,
  onGallery,
  selected,
  selectionActive,
  onSelect,
}: ImageCardProps) {
  const navigate = useNavigate()

  const hasChildren = (editChildren?.length ?? 0) > 0

  const moreButton = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="group/btn flex items-center justify-center p-2.5 -m-1 cursor-pointer"
          aria-label="More actions"
        >
          <span className="flex items-center justify-center rounded bg-background/80 backdrop-blur-sm p-1 text-muted-foreground group-hover/btn:bg-sidebar-selected group-hover/btn:text-sidebar-selected-text group-hover/btn:scale-[1.75] group-hover/btn:shadow-sm transition-all duration-150">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </span>
        </button>
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
        {onDescribe && (
          <DropdownMenuItem onClick={() => onDescribe(img)}>
            <MessageSquare className="h-4 w-4" />
            Describe
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const rightButtons = (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onDelete(img)
      }}
      className="group/del flex items-center justify-center p-2.5 -m-1 cursor-pointer"
      aria-label="Delete"
    >
      <span className="flex items-center justify-center rounded bg-background/80 backdrop-blur-sm p-1 text-muted-foreground group-hover/del:bg-sidebar-selected group-hover/del:text-destructive group-hover/del:scale-[1.75] group-hover/del:shadow-sm transition-all duration-150">
        <Trash2 className="h-3.5 w-3.5" />
      </span>
    </button>
  )

  return (
    <Thumbnail
      url={imageUrl}
      alt={img.title}
      status="complete"
      objectFit={objectFit}
      compact={compact}
      alwaysShowOverlay
      selected={selected}
      selectedClassName="border-accent-brand ring-1 ring-accent-brand"
      overlayActionsLeft={selectionActive ? undefined : moreButton}
      overlayActions={selectionActive ? undefined : rightButtons}
      overlayActionsBottomLeft={
        onSelect ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSelect(img.id, e.shiftKey)
            }}
            className="group/sel flex items-center justify-center p-2.5 -m-1 cursor-pointer"
            aria-label={selected ? 'Deselect' : 'Select'}
          >
            <span className="flex items-center justify-center rounded bg-background/80 backdrop-blur-sm p-1 text-muted-foreground group-hover/sel:bg-sidebar-selected group-hover/sel:text-sidebar-selected-text group-hover/sel:scale-[1.75] group-hover/sel:shadow-sm transition-all duration-150">
              {selected ? (
                <CheckCircle2 className="h-4 w-4 text-accent-brand" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </span>
          </button>
        ) : undefined
      }
      overlayActionsBottomRight={
        onGallery && !selectionActive ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onGallery(img)
            }}
            className="group/lb flex items-center justify-center p-2.5 -m-1 cursor-pointer"
            aria-label="View in lightbox"
          >
            <span className="flex items-center justify-center rounded bg-background/80 backdrop-blur-sm p-1 text-muted-foreground group-hover/lb:bg-sidebar-selected group-hover/lb:text-sidebar-selected-text group-hover/lb:scale-[1.75] group-hover/lb:shadow-sm transition-all duration-150">
              <Maximize2 className="h-3.5 w-3.5" />
            </span>
          </button>
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
          navigate({
            to: '/dashboard/edit/$imageId',
            params: { imageId: img.id },
            search: { sourceId: undefined },
          })
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
                      navigate({
                        to: '/dashboard/edit/$imageId',
                        params: { imageId: img.id },
                        search: { sourceId: child.id },
                      })
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
