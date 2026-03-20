import { useNavigate } from '@tanstack/react-router'
import {
  ArrowUpRight,
  Download,
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
  getModelName: (id: string) => string
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
  getModelName,
}: ImageCardProps) {
  const navigate = useNavigate()

  const hasChildren = (editChildren?.length ?? 0) > 0

  const moreButton = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="rounded bg-background/80 backdrop-blur-sm p-1 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
          aria-label="More actions"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
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
      className="rounded bg-background/80 backdrop-blur-sm p-1 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
      aria-label="Delete"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )

  return (
    <Thumbnail
      url={imageUrl}
      alt={img.title}
      status="complete"
      objectFit={objectFit}
      compact={compact}
      label={
        img.generation_metadata
          ? getModelName(img.generation_metadata.model)
          : undefined
      }
      alwaysShowOverlay
      overlayActionsLeft={moreButton}
      overlayActions={rightButtons}
      onClick={() =>
        navigate({
          to: '/dashboard/edit/$imageId',
          params: { imageId: img.id },
          search: { sourceId: undefined },
        })
      }
    >
      {!compact && (
        <>
          <div className="p-1.5">
            <button
              onClick={() =>
                navigate({
                  to: '/dashboard/edit/$imageId',
                  params: { imageId: img.id },
                  search: { sourceId: undefined },
                })
              }
              className="w-full rounded bg-muted px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
            >
              Edit
            </button>
          </div>
          {showInfo && (
            <ExpandableText
              text={
                img.description ?? img.generation_metadata?.prompt ?? img.title
              }
              className="px-3 pt-1 pb-3"
              textClassName="text-xs text-muted-foreground"
            />
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
