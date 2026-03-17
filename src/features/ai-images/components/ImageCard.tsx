import { useNavigate } from '@tanstack/react-router'
import { ArrowUpRight, MoreHorizontal, Trash2, Unlink } from 'lucide-react'
import type { SavedAiImage } from '@/features/ai-images/types'
import type { EditChildrenMap } from '@/features/ai-images/hooks/use-edit-children'
import { Thumbnail } from '@/components/Thumbnail'
import { ExpandableText } from '@/components/ExpandableText'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ImageCardProps {
  img: SavedAiImage
  imageUrl: string | undefined
  objectFit?: 'contain' | 'cover'
  rootImageUrl?: string
  rootIsHidden?: boolean
  editChildren?: EditChildrenMap[string]
  onRestore?: () => void
  onOpen: (img: SavedAiImage) => void
  onDelete: (img: SavedAiImage) => void
  onStartAdopt?: (img: SavedAiImage) => void
  onDetach?: (img: SavedAiImage) => void
  getModelName: (id: string) => string
}

export function ImageCard({
  img,
  imageUrl,
  objectFit,
  rootImageUrl,
  rootIsHidden,
  editChildren,
  onRestore,
  onOpen,
  onDelete,
  onStartAdopt,
  onDetach,
  getModelName,
}: ImageCardProps) {
  const navigate = useNavigate()

  const hasParent = !!img.generation_metadata?.source_image_id

  const dropdownTrigger = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="rounded bg-background/80 backdrop-blur-sm p-1 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
          aria-label="Image actions"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {onStartAdopt && (
          <DropdownMenuItem onClick={() => onStartAdopt(img)}>
            <ArrowUpRight className="h-4 w-4 mr-2" />
            Move under...
          </DropdownMenuItem>
        )}
        {hasParent && onDetach && (
          <DropdownMenuItem onClick={() => onDetach(img)}>
            <Unlink className="h-4 w-4 mr-2" />
            Detach
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onDelete(img)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <Thumbnail
      url={imageUrl}
      alt={img.title}
      status="complete"
      objectFit={objectFit}
      label={
        img.generation_metadata
          ? getModelName(img.generation_metadata.model)
          : undefined
      }
      overlayActions={dropdownTrigger}
      onClick={() => imageUrl && onOpen(img)}
    >
      <div className="p-1.5">
        <button
          onClick={() =>
            navigate({
              to: '/dashboard/edit/$imageId',
              params: { imageId: img.id },
            })
          }
          className="w-full rounded bg-muted px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
        >
          Edit
        </button>
      </div>
      <ExpandableText
        text={img.generation_metadata?.prompt ?? img.title}
        className="px-3 pt-1 pb-3"
        textClassName="text-xs text-muted-foreground"
      />
      {rootImageUrl && (
        <div className="px-3 pb-3 flex items-center gap-2">
          <img
            src={rootImageUrl}
            className="w-8 h-8 rounded object-cover border border-border"
            alt="Original"
          />
          <span className="text-[10px] text-muted-foreground">Original</span>
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
    </Thumbnail>
  )
}
